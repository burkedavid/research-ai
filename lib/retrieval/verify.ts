import type { RetrievedChunk } from "./search";

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  filename: string;
  sourceType: string;
  evidenceType: string;
  wave: string;
  segmentName: string | null;
  interviewRef: string | null;
  sectionPath: string | null;
  pageRef: string | null;
}

export interface QuoteCheck {
  quote: string;
  citedBlock: number | null;
  verified: boolean;
  reason?: "no_citation" | "block_out_of_range" | "not_direct_quote" | "text_mismatch";
}

export interface VerificationReport {
  citedBlocks: number[];
  invalidCitations: number[];
  quoteChecks: QuoteCheck[];
  allQuotesVerified: boolean;
  hasCitations: boolean;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * Quote integrity is mechanical, not trusted (§B7): every quoted span in the
 * generated answer is string-matched against its cited chunk. Quotes from
 * non-direct_quote blocks or with text drift are flagged; the UI shows
 * "quote could not be verified against source".
 */
export function verifyAnswer(answerText: string, chunks: RetrievedChunk[]): VerificationReport {
  const citedBlocks = [...new Set([...answerText.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort(
    (a, b) => a - b,
  );
  const invalidCitations = citedBlocks.filter((n) => n < 1 || n > chunks.length);

  const quoteChecks: QuoteCheck[] = [];
  // quoted spans: "..." (straight or curly), min length to skip scare quotes
  const quoteRe = /[“"]([^”"]{20,}?)[”"]\s*((?:\[\d+\])+)?/g;
  let match: RegExpExecArray | null;
  while ((match = quoteRe.exec(answerText)) !== null) {
    const quote = match[1].trim();
    const citationGroup = match[2];
    if (!citationGroup) {
      quoteChecks.push({ quote, citedBlock: null, verified: false, reason: "no_citation" });
      continue;
    }
    const blockNums = [...citationGroup.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    let verified = false;
    let reason: QuoteCheck["reason"] = "text_mismatch";
    let citedBlock: number | null = null;
    for (const n of blockNums) {
      citedBlock = n;
      const chunk = chunks[n - 1];
      if (!chunk) {
        reason = "block_out_of_range";
        continue;
      }
      if (chunk.evidenceType !== "direct_quote") {
        reason = "not_direct_quote";
        continue;
      }
      if (normalise(chunk.content).includes(normalise(quote))) {
        verified = true;
        break;
      }
    }
    quoteChecks.push({ quote, citedBlock, verified, reason: verified ? undefined : reason });
  }

  return {
    citedBlocks,
    invalidCitations,
    quoteChecks,
    allQuotesVerified: quoteChecks.every((q) => q.verified),
    hasCitations: citedBlocks.length > 0,
  };
}

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk, i) => ({
    n: i + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    filename: chunk.filename,
    sourceType: chunk.sourceType,
    evidenceType: chunk.evidenceType,
    wave: `${chunk.year}-${String(chunk.month).padStart(2, "0")}`,
    segmentName: chunk.segmentName,
    interviewRef: chunk.interviewRef,
    sectionPath: chunk.sectionPath,
    pageRef: chunk.pageRef,
  }));
}
