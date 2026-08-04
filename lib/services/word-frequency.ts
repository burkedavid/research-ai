import { createHash } from "node:crypto";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/errors";
import { fetchChunkContents, searchChunks, type SearchFilters } from "@/lib/retrieval/search";
import { countTerms, type FrequencyItem } from "@/lib/text/word-frequency";

export interface WordFrequencyResult {
  /** the topic the words describe, if the request was topic-scoped */
  topic: string | null;
  words: FrequencyItem[];
  phrases: FrequencyItem[];
  /** how many chunks the counts were computed over — a small-base signal */
  chunkCount: number;
  filtersApplied: SearchFilters;
}

/**
 * Most common words & phrases (item 4), scoped to a period (via filters) and an
 * optional topic. With a topic, counts are taken over the chunks THE RETRIEVAL
 * LAYER considers relevant to it ("words used to describe the economy"); without
 * one, over every chunk in scope. ACL is enforced in the SQL both ways, so a
 * user without transcript access never sees transcript language.
 */
export async function analyzeWordFrequency(params: {
  user: SessionUser;
  filters?: SearchFilters;
  topic?: string | null;
  maxWords?: number;
  maxPhrases?: number;
  ip?: string | null;
}): Promise<WordFrequencyResult> {
  const { user } = params;
  const topic = params.topic?.trim() ? params.topic.trim() : null;
  const filters = params.filters ?? {};

  let texts: string[];
  if (topic) {
    // topic-scoped: aggregate over the passages relevant to the topic
    const retrieval = await searchChunks({ query: topic, filters, user, k: 80, log: false });
    texts = retrieval.chunks.map((c) => c.content);
  } else {
    texts = await fetchChunkContents({ filters, user, limit: 5000 });
  }

  const { words, phrases } = countTerms(texts, {
    maxWords: params.maxWords ?? 40,
    maxPhrases: params.maxPhrases ?? 25,
  });

  await audit({
    userId: user.id,
    action: "search",
    detail: {
      feature: "word_frequency",
      topicHash: topic ? createHash("sha256").update(topic).digest("hex").slice(0, 32) : null,
    },
    ip: params.ip,
  });

  return { topic, words, phrases, chunkCount: texts.length, filtersApplied: filters };
}
