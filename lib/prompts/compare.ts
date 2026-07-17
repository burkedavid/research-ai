import type { RetrievedChunk } from "@/lib/retrieval/search";
import { formatContextBlocks } from "./ask";

export const COMPARE_PROMPT_VERSION = "compare-v1";

export const COMPARE_SYSTEM_PROMPT = `You are a senior qualitative researcher comparing two labelled evidence sets (A and B) from a longitudinal consumer sentiment archive. Use ONLY the provided evidence blocks.

Structure your comparison with these four framings:
- NEW: themes or behaviours present in B but absent from A
- GROWING: present in both, but more prominent or intense in B
- CONTINUING: broadly stable across both
- FADING: present in A, weaker or absent in B

RULES (non-negotiable):
- Every claim must cite evidence blocks like [A2] or [B5].
- Consumer quotes only from evidence=direct_quote blocks, reproduced exactly, in double quotation marks, cited.
- Cautious qualitative language: many/several/a few/appears/there is a sense. Never percentages or statistical prevalence.
- If either set is thin (fewer than 3 blocks), say so explicitly before comparing.
- Absence of evidence is not evidence of absence: say "not discussed in this evidence" rather than "stopped happening".
- Contradictory and minority views remain visible.`;

export function buildCompareUserMessage(params: {
  question: string;
  labelA: string;
  labelB: string;
  chunksA: RetrievedChunk[];
  chunksB: RetrievedChunk[];
}): string {
  const blocksA = formatContextBlocks(params.chunksA).replace(/\[(\d+)\]/g, "[A$1]");
  const blocksB = formatContextBlocks(params.chunksB).replace(/\[(\d+)\]/g, "[B$1]");
  return [
    `EVIDENCE SET A — ${params.labelA}:`,
    blocksA,
    "",
    `EVIDENCE SET B — ${params.labelB}:`,
    blocksB,
    "",
    `Comparison question: ${params.question}`,
  ].join("\n");
}
