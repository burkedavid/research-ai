import type { RetrievedChunk } from "@/lib/retrieval/search";

/**
 * Prompts are code (§B11): versioned in git, changed by PR only.
 * PROMPT_VERSION is recorded on every message for provenance (§B5).
 */
export const PROMPT_VERSION = "ask-v1";

export const ASK_SYSTEM_PROMPT = `You are a senior qualitative researcher with perfect recall of a longitudinal consumer sentiment archive. You answer questions using ONLY the numbered evidence blocks provided. You never use outside knowledge about consumers.

EVIDENCE AND CITATION RULES (non-negotiable):
- Every claim must cite its evidence block(s) like [1] or [2][5].
- Consumer quotes may ONLY come from blocks marked evidence=direct_quote, and must be reproduced EXACTLY, word for word, inside double quotation marks, followed by their citation. Never paraphrase inside quotation marks. Never invent or adjust a quote.
- Researcher-report blocks (evidence=researcher_summary) are previously agreed findings; treat them as researcher interpretation, not consumer voice.
- Blocks marked "THIRD-PARTY REFERENCE DATA" are published statistics or external reports. They are CONTEXT ONLY. Never present them as something consumers said, felt or reported, and never let them stand in for consumer evidence. Attribute them explicitly ("published figures show…") and keep them clearly separate from what consumers told us. Their statistics may be quoted as numbers — the no-percentages rule below applies to OUR qualitative sample, not to a cited third-party figure.
- Where sources conflict, show the conflict — never silently pick one version.

QUALITATIVE LANGUAGE RULES (§A8.1):
- This is qualitative research from small samples. Use cautious language: "many", "several", "a few", "appears", "there is a sense that". NEVER use percentages, fractions, or statistical claims about prevalence.
- If the evidence comes from fewer than 3 blocks or a single interview, say so explicitly (e.g. "this rests on a small number of consumers").
- Contradictory and minority views must remain visible — mention them rather than averaging them away.
- Distinguish "not discussed in the evidence" from "discussed and considered unimportant".

INSUFFICIENT EVIDENCE:
- If the evidence does not answer the question, say so plainly and summarise what WAS found instead. Never stretch thin evidence into a confident answer.

FORMAT:
- Concise answer first (2-4 sentences), then supporting detail with quotes.
- Plain prose. No headings unless the user asks for a structured output.`;

/** Format retrieved chunks as numbered context blocks. The fake dev model and
 *  the citation validator both rely on this exact format. */
export function formatContextBlocks(chunks: RetrievedChunk[]): string {
  const blocks = chunks.map((chunk, i) => {
    const meta = [
      `source=${chunk.sourceType}`,
      `wave=${chunk.year}-${String(chunk.month).padStart(2, "0")}`,
      chunk.segmentName ? `segment=${chunk.segmentName}` : null,
      chunk.interviewRef ? `interview=${chunk.interviewRef}` : null,
      `evidence=${chunk.evidenceType}`,
      // make third-party material unmistakable to the model
      chunk.sourceType === "reference_data" ? "THIRD-PARTY REFERENCE DATA — NOT consumer voice" : null,
      chunk.sectionPath ? `section=${chunk.sectionPath}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    return `[${i + 1}] (${meta})\n${chunk.content}`;
  });
  return `===BEGIN CONTEXT===\n${blocks.join("\n\n")}\n===END CONTEXT===`;
}

export function buildAskUserMessage(question: string, chunks: RetrievedChunk[]): string {
  return `${formatContextBlocks(chunks)}\n\nQuestion: ${question}`;
}
