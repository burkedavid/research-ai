import { createHash } from "node:crypto";
import { generateText } from "ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { audit } from "@/lib/audit";
import { VERSIONS } from "@/lib/config";
import type { SessionUser } from "@/lib/errors";
import { getLlm } from "@/lib/llm";
import { resolveModel } from "@/lib/services/model-settings";
import { COMPARE_PROMPT_VERSION, COMPARE_SYSTEM_PROMPT, buildCompareUserMessage } from "@/lib/prompts/compare";
import { computeEvidentialBasis, type EvidentialBasis } from "@/lib/retrieval/confidence";
import { searchChunks, type SearchFilters } from "@/lib/retrieval/search";
import { buildCitations, type Citation } from "@/lib/retrieval/verify";
import { estimateCostGbp } from "./ask";

export interface CompareSide {
  label: string;
  filters: SearchFilters;
  citations: Citation[];
  basis: EvidentialBasis;
}

export interface CompareResult {
  text: string;
  sideA: CompareSide;
  sideB: CompareSide;
  provenance: {
    model: string;
    promptVersion: string;
    retrievalVersion: string;
    embeddingModel: string;
    usage: { input_tokens: number; output_tokens: number; est_cost_gbp: number };
  };
}

/**
 * Comparison mode (§B7): identical query, differing filters, one generation
 * pass over both labelled evidence sets with the new/growing/continuing/fading
 * framing (§A7.1, §A10.7).
 */
export async function comparePeriods(params: {
  user: SessionUser;
  question: string;
  labelA: string;
  filtersA: SearchFilters;
  labelB: string;
  filtersB: SearchFilters;
  ip?: string | null;
}): Promise<CompareResult> {
  const { user, question } = params;

  const [retrievalA, retrievalB] = await Promise.all([
    searchChunks({ query: question, filters: params.filtersA, user, k: 8 }),
    searchChunks({ query: question, filters: params.filtersB, user, k: 8 }),
  ]);

  await audit({
    userId: user.id,
    action: "search",
    detail: {
      queryHash: createHash("sha256").update(question).digest("hex").slice(0, 32),
      feature: "compare",
      labels: [params.labelA, params.labelB],
    },
    ip: params.ip,
  });

  const { model, modelId } = getLlm("query", await resolveModel("query"));
  const result = await generateText({
    model,
    system: COMPARE_SYSTEM_PROMPT,
    prompt: buildCompareUserMessage({
      question,
      labelA: params.labelA,
      labelB: params.labelB,
      chunksA: retrievalA.chunks,
      chunksB: retrievalB.chunks,
    }),
  });

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;

  await recordAiUsage({
    kind: "chat",
    model: modelId,
    feature: "compare",
    inputTokens,
    outputTokens,
    userId: user.id,
  });

  return {
    text: result.text,
    sideA: {
      label: params.labelA,
      filters: params.filtersA,
      citations: buildCitations(retrievalA.chunks),
      basis: computeEvidentialBasis(retrievalA.chunks),
    },
    sideB: {
      label: params.labelB,
      filters: params.filtersB,
      citations: buildCitations(retrievalB.chunks),
      basis: computeEvidentialBasis(retrievalB.chunks),
    },
    provenance: {
      model: modelId,
      promptVersion: COMPARE_PROMPT_VERSION,
      retrievalVersion: VERSIONS.retrieval,
      embeddingModel: retrievalA.embeddingModel,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        est_cost_gbp: estimateCostGbp(modelId, inputTokens, outputTokens),
      },
    },
  };
}
