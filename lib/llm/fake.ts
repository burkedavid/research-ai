import type { LanguageModelV3, LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV3 } from "ai/test";

/**
 * Deterministic fake language model for dev and tests (env.ts forbids it in
 * production). It reads the numbered context blocks from the prompt (the
 * format defined in lib/prompts) and produces a grounded, cited answer with
 * cautious qualitative language, exactly one verbatim quote from a
 * direct_quote block, and a small-base note when evidence is thin — so the
 * golden-question suite exercises the real citation, quote-verification and
 * caveat machinery end to end.
 */

interface ContextBlock {
  n: number;
  meta: string;
  content: string;
  isDirectQuote: boolean;
}

export function parseContextBlocks(promptText: string): ContextBlock[] {
  const blocks: ContextBlock[] = [];
  const re = /^\[(\d+)\]\s*\(([^)]*)\)\n([\s\S]*?)(?=^\[\d+\]\s*\(|^===END CONTEXT===$)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(promptText)) !== null) {
    blocks.push({
      n: Number(match[1]),
      meta: match[2],
      content: match[3].trim(),
      isDirectQuote: match[2].includes("evidence=direct_quote"),
    });
  }
  return blocks;
}

/** First consumer sentence of a direct-quote block, reproduced verbatim. */
function pickQuote(block: ContextBlock): string | null {
  const consumerLine = block.content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("CONSUMER:"));
  const source = consumerLine ? consumerLine.replace(/^CONSUMER:\s*/, "") : block.content;
  const sentence = source.match(/[^.!?]+[.!?]/)?.[0]?.trim();
  return sentence && sentence.length > 20 ? sentence : null;
}

export function composeFakeAnswer(promptText: string): string {
  const blocks = parseContextBlocks(promptText);
  if (blocks.length === 0) {
    return "There is not enough evidence in the archive to answer this question. No relevant passages were retrieved for the selected filters.";
  }

  const parts: string[] = [];
  const citeAll = blocks.map((b) => `[${b.n}]`).join(" ");
  parts.push(
    `Across the retrieved evidence, several consumers spoke to this topic, though views were not uniform ${citeAll}.`,
  );

  const quoteBlock = blocks.find((b) => b.isDirectQuote && pickQuote(b));
  if (quoteBlock) {
    parts.push(`One consumer put it directly: "${pickQuote(quoteBlock)}" [${quoteBlock.n}].`);
  }

  const summaryBlock = blocks.find((b) => !b.isDirectQuote);
  if (summaryBlock) {
    parts.push(
      `The researcher-reported findings appear consistent with this, though there is a sense that emphasis varied by segment [${summaryBlock.n}].`,
    );
  }

  parts.push(
    blocks.length < 3
      ? `Small base: this observation rests on ${blocks.length} passage${blocks.length === 1 ? "" : "s"} and should be treated as indicative only.`
      : "As with all qualitative findings, these counts reflect the sample discussed, not statistical prevalence.",
  );

  return parts.join(" ");
}

function promptToText(prompt: unknown): string {
  const messages = prompt as { role: string; content: unknown }[];
  return messages
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : (m.content as { type: string; text?: string }[])
            .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
            .join("\n"),
    )
    .join("\n");
}

export function createFakeModel(): LanguageModelV3 {
  return new MockLanguageModelV3({
    modelId: "fake-llm",
    doGenerate: async (options) => {
      const text = composeFakeAnswer(promptToText(options.prompt));
      return {
        content: [{ type: "text" as const, text }],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: {
          inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 120, text: 120, reasoning: 0 },
        },
        warnings: [],
      };
    },
    doStream: async (options) => {
      const text = composeFakeAnswer(promptToText(options.prompt));
      const words = text.split(" ");
      const parts: LanguageModelV3StreamPart[] = [
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "1" },
        ...words.map(
          (w, i): LanguageModelV3StreamPart => ({
            type: "text-delta",
            id: "1",
            delta: i === 0 ? w : ` ${w}`,
          }),
        ),
        { type: "text-end", id: "1" },
        {
          type: "finish" as const,
          finishReason: { unified: "stop" as const, raw: "stop" },
          usage: {
            inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: words.length, text: words.length, reasoning: 0 },
          },
        },
      ];
      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  });
}
