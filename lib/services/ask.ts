import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { streamText } from "ai";
import { db } from "@/db";
import { conversations, messages, retrievalLog } from "@/db/schema";
import { recordAiUsage } from "@/lib/ai-usage";
import { audit } from "@/lib/audit";
import { COST_PER_MTOK_GBP, VERSIONS } from "@/lib/config";
import type { SessionUser } from "@/lib/errors";
import { getLlm } from "@/lib/llm";
import { ASK_SYSTEM_PROMPT, PROMPT_VERSION, buildAskUserMessage } from "@/lib/prompts/ask";
import { computeEvidentialBasis } from "@/lib/retrieval/confidence";
import { searchChunks, type SearchFilters } from "@/lib/retrieval/search";
import { buildCitations, verifyAnswer } from "@/lib/retrieval/verify";

export function estimateCostGbp(modelId: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MTOK_GBP[modelId] ?? { input: 0, output: 0 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

/**
 * Ask the Archive (§B7, §B8): retrieval → grounded streamed generation →
 * mechanical verification → full-provenance persistence. The response is a
 * newline-delimited JSON stream: {type:"meta"} first (citations, evidential
 * basis, explainability), then {type:"delta"} text chunks, then {type:"done"}
 * with the verification report.
 */
export async function runAsk(params: {
  user: SessionUser;
  question: string;
  filters?: SearchFilters;
  conversationId?: string;
  ip?: string | null;
}): Promise<Response> {
  const { user, question, filters } = params;

  let conversationId = params.conversationId;
  if (conversationId) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv || conv.userId !== user.id) conversationId = undefined;
  }
  if (!conversationId) {
    const [conv] = await db
      .insert(conversations)
      .values({ userId: user.id, title: question.slice(0, 120) })
      .returning();
    conversationId = conv.id;
  }

  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: question,
    filters: filters as Record<string, unknown>,
  });

  const retrieval = await searchChunks({ query: question, filters, user, log: false });
  const citations = buildCitations(retrieval.chunks);
  const basis = computeEvidentialBasis(retrieval.chunks);
  const explainability = {
    filtersApplied: retrieval.filtersApplied,
    candidateCount: retrieval.candidateCount,
    weakEvidence: retrieval.weakEvidence,
    results: retrieval.chunks.map((c, i) => ({ n: i + 1, filename: c.filename, ...c.match })),
  };

  await audit({
    userId: user.id,
    action: "search",
    entityType: "conversation",
    entityId: conversationId,
    detail: { queryHash: createHash("sha256").update(question).digest("hex").slice(0, 32), feature: "ask" },
    ip: params.ip,
  });

  const { model, modelId } = getLlm("query");
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, obj: unknown) =>
    controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      send(controller, { type: "meta", conversationId, citations, basis, explainability });
      try {
        const result = streamText({
          model,
          system: ASK_SYSTEM_PROMPT,
          prompt: buildAskUserMessage(question, retrieval.chunks),
        });

        let fullText = "";
        for await (const delta of result.textStream) {
          fullText += delta;
          send(controller, { type: "delta", text: delta });
        }

        const verification = verifyAnswer(fullText, retrieval.chunks);
        const usage = await result.usage;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;

        await recordAiUsage({
          kind: "chat",
          model: modelId,
          feature: "ask",
          inputTokens,
          outputTokens,
          userId: user.id,
        });

        const [assistantMessage] = await db
          .insert(messages)
          .values({
            conversationId: conversationId!,
            role: "assistant",
            content: fullText,
            filters: filters as Record<string, unknown>,
            model: modelId,
            citations: { citations, basis, verification, explainability } as unknown as Record<string, unknown>,
            promptVersion: PROMPT_VERSION,
            embeddingModel: retrieval.embeddingModel,
            retrievalVersion: VERSIONS.retrieval,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              est_cost_gbp: estimateCostGbp(modelId, inputTokens, outputTokens),
            },
          })
          .returning();

        await db.insert(retrievalLog).values({
          messageId: assistantMessage.id,
          userId: user.id,
          queryHash: createHash("sha256").update(question).digest("hex").slice(0, 32),
          filters: (filters ?? {}) as Record<string, unknown>,
          candidateCount: retrieval.candidateCount,
          topRrfScore: retrieval.topRrfScore,
          weakEvidence: retrieval.weakEvidence,
        });

        send(controller, { type: "done", messageId: assistantMessage.id, verification });
      } catch (err) {
        // log the error class only — provider errors can echo prompt content,
        // which must never reach production logs (§B9.5)
        console.error("ASK_STREAM_ERROR", err instanceof Error ? err.name : "unknown");
        send(controller, { type: "error", error: "Generation failed. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
