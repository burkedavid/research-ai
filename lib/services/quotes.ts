import { createHash } from "node:crypto";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/errors";
import { searchChunks, type SearchFilters } from "@/lib/retrieval/search";

export interface QuoteResult {
  chunkId: string;
  documentId: string;
  quote: string;
  /** the moderator question that prompted it, for context */
  question: string | null;
  speaker: string;
  interviewRef: string | null;
  segmentName: string | null;
  wave: string;
  /** exact day-level report date (item 5), if known */
  reportDate: string | null;
  filename: string;
  sentiment: string | null;
  region: string | null;
  score: number;
  matchedSemantic: boolean;
  matchedKeyword: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function trigrams(s: string): Set<string> {
  const t = new Set<string>();
  const padded = `  ${norm(s)} `;
  for (let i = 0; i < padded.length - 2; i++) t.add(padded.slice(i, i + 3));
  return t;
}

function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Quote Finder (§B8, §A7.5): direct consumer verbatim only, ranked by
 * retrieval strength, near-duplicates collapsed by trigram similarity.
 */
export async function findQuotes(params: {
  user: SessionUser;
  query: string;
  filters?: SearchFilters;
  collapseDuplicates?: boolean;
  k?: number;
  ip?: string | null;
}): Promise<{ quotes: QuoteResult[]; weakEvidence: boolean; explainability: unknown }> {
  const { user, query } = params;
  const filters: SearchFilters = {
    ...params.filters,
    evidenceTypes: ["direct_quote"],
  };

  const retrieval = await searchChunks({ query, filters, user, k: params.k ?? 20 });

  await audit({
    userId: user.id,
    action: "search",
    detail: { queryHash: createHash("sha256").update(query).digest("hex").slice(0, 32), feature: "quotes" },
    ip: params.ip,
  });

  const quotes: QuoteResult[] = [];
  for (const chunk of retrieval.chunks) {
    // split the Q&A chunk into (question, answer) utterances
    const lines = chunk.content.split(/\n{2,}/);
    let lastQuestion: string | null = null;
    for (const line of lines) {
      if (line.startsWith("MODERATOR:")) {
        lastQuestion = line.replace(/^MODERATOR:\s*/, "").trim();
      } else if (line.startsWith("CONSUMER:")) {
        quotes.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          quote: line.replace(/^CONSUMER:\s*/, "").trim(),
          question: lastQuestion,
          speaker: "consumer",
          interviewRef: chunk.interviewRef,
          segmentName: chunk.segmentName,
          wave: `${chunk.year}-${String(chunk.month).padStart(2, "0")}`,
          reportDate: chunk.reportDate,
          filename: chunk.filename,
          sentiment: chunk.sentiment,
          region: chunk.region,
          score: chunk.match.rrfScore,
          matchedSemantic: chunk.match.semantic,
          matchedKeyword: chunk.match.keyword,
        });
      } else if (chunk.speakerRole === "consumer" && line.trim()) {
        // consumer-only chunks with no explicit labels
        quotes.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          quote: line.trim(),
          question: null,
          speaker: "consumer",
          interviewRef: chunk.interviewRef,
          segmentName: chunk.segmentName,
          wave: `${chunk.year}-${String(chunk.month).padStart(2, "0")}`,
          reportDate: chunk.reportDate,
          filename: chunk.filename,
          sentiment: chunk.sentiment,
          region: chunk.region,
          score: chunk.match.rrfScore,
          matchedSemantic: chunk.match.semantic,
          matchedKeyword: chunk.match.keyword,
        });
      }
    }
  }

  quotes.sort((a, b) => b.score - a.score);

  let final = quotes;
  if (params.collapseDuplicates !== false) {
    final = [];
    for (const quote of quotes) {
      if (!final.some((kept) => trigramSimilarity(kept.quote, quote.quote) > 0.6)) {
        final.push(quote);
      }
    }
  }

  return {
    quotes: final,
    weakEvidence: retrieval.weakEvidence,
    explainability: {
      filtersApplied: retrieval.filtersApplied,
      candidateCount: retrieval.candidateCount,
      results: retrieval.chunks.map((c, i) => ({ n: i + 1, filename: c.filename, ...c.match })),
    },
  };
}
