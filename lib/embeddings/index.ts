import { approxTokens } from "@/lib/ai-usage";
import { EMBEDDING } from "@/lib/config";
import { env } from "@/lib/env";

export type EmbeddingInputType = "document" | "query";

export interface EmbeddingsProvider {
  /** Model identifier recorded on messages for provenance (§B5). */
  model: string;
  embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]>;
  /** Prompt tokens billed by the most recent embed() call. Exact when the
   *  provider reports usage; approximated otherwise. Read immediately after
   *  embed() so embedding spend can be recorded in the ai_usage ledger. */
  lastTokens(): number;
}

/**
 * Deterministic bag-of-words hash embeddings for dev and tests: no API key,
 * fully reproducible, and cosine similarity correlates with token overlap —
 * enough for the golden-question suite to exercise the real vector SQL path.
 * env.ts forbids this provider in production.
 */
function fakeProvider(): EmbeddingsProvider {
  const dims = EMBEDDING.dimensions;
  const model = EMBEDDING.models.fake;
  const hash = (s: string, seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  };
  const embedOne = (text: string): number[] => {
    const v = new Array<number>(dims).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    for (const t of tokens) {
      // crude stem so "worried"/"worries" land near each other
      const stem = t.replace(/(ing|ed|es|s)$/i, "");
      for (const seed of [17, 101, 6007]) {
        v[hash(stem, seed) % dims] += 1;
      }
    }
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return v.map((x) => x / norm);
  };
  let tokens = 0;
  return {
    model,
    async embed(texts) {
      tokens = approxTokens(texts);
      return texts.map(embedOne);
    },
    lastTokens: () => tokens,
  };
}

function voyageProvider(): EmbeddingsProvider {
  const model = EMBEDDING.models.voyage;
  let tokens = 0;
  return {
    model,
    lastTokens: () => tokens,
    async embed(texts, inputType) {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: texts,
          input_type: inputType,
          output_dimension: EMBEDDING.dimensions,
        }),
      });
      if (!res.ok) {
        throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
      }
      const body = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
        usage?: { total_tokens?: number };
      };
      tokens = body.usage?.total_tokens ?? approxTokens(texts);
      return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  };
}

/**
 * OpenAI embeddings via the REST API (same fetch style as Voyage — no SDK dep).
 * `dimensions` requests text-embedding-3-large truncated to our canonical 1024
 * width (Matryoshka), so the existing vector(1024) column + HNSW index are
 * untouched. `inputType` has no OpenAI equivalent and is intentionally ignored.
 */
export function openaiProvider(): EmbeddingsProvider {
  const model = EMBEDDING.models.openai;
  let tokens = 0;
  return {
    model,
    lastTokens: () => tokens,
    async embed(texts) {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: texts,
          dimensions: EMBEDDING.dimensions,
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
      }
      const body = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
        usage?: { prompt_tokens?: number; total_tokens?: number };
      };
      // OpenAI reports exact prompt tokens for embeddings — use them
      tokens = body.usage?.prompt_tokens ?? body.usage?.total_tokens ?? approxTokens(texts);
      return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  };
}

export function getEmbeddings(): EmbeddingsProvider {
  switch (env.EMBEDDINGS_PROVIDER) {
    case "voyage":
      return voyageProvider();
    case "openai":
      return openaiProvider();
    case "fake":
      return fakeProvider();
  }
}
