/**
 * Model IDs and provider routing live in this one module (§B3, §B11).
 * Swapping Sonnet↔Haiku or direct↔gateway is a one-line change here.
 */
export const MODELS = {
  /** User-facing queries and report drafts (§B3: Sonnet-class). */
  query: "claude-sonnet-4-6",
  /** Ingestion metadata suggestion (§B3: Haiku, high-volume/low-difficulty). */
  ingestion: "claude-haiku-4-5-20251001",
} as const;

/**
 * OpenAI equivalents, used when LLM_PROVIDER=openai (same query/ingestion
 * split). IDs are env-overridable (OPENAI_QUERY_MODEL / OPENAI_INGESTION_MODEL)
 * so a model rename is a config fix, never a code change — confirm the exact
 * IDs against `GET https://api.openai.com/v1/models` once a key is in hand.
 */
export const OPENAI_MODELS = {
  /** User-facing queries and report drafts (verified against /v1/models). */
  query: "gpt-5.6-sol",
  /** Ingestion metadata suggestion — high-volume, lower difficulty. */
  ingestion: "gpt-5.6-luna",
} as const;

export const EMBEDDING = {
  /** The one canonical column/index dimension. All providers emit this width. */
  dimensions: 1024,
  /**
   * Per-provider model. OpenAI large is requested AT 1024 dims (Matryoshka):
   * the `vector` HNSW index caps ~2000 dims, so native 3072 would force a
   * halfvec migration for no real gain — large@1024 already beats small@1024.
   */
  models: {
    voyage: "voyage-3.5-lite",
    openai: "text-embedding-3-large",
    fake: "fake-embeddings-1024",
  },
} as const;

/**
 * £ per 1M tokens, used to turn exact token counts into an estimated spend.
 *
 * IMPORTANT — accuracy: token counts in the ai_usage ledger come straight from
 * the provider response and are exact. These PRICES are the only estimated
 * part, so keep them current from the provider's own pricing page and set
 * `verified` once you have checked a figure against a real invoice. Anything
 * left unverified is flagged in the admin summary rather than presented as
 * fact. A model with no entry at all is reported separately as uncosted — it
 * must never silently contribute £0 to a budget.
 *
 * Embedding models bill on input tokens only (output is 0).
 */
export interface Rate {
  input: number;
  output: number;
  /** true once checked against an actual provider invoice */
  verified?: boolean;
}

export const COST_PER_MTOK_GBP: Record<string, Rate> = {
  "claude-sonnet-4-6": { input: 2.4, output: 12.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  // OpenAI chat — update from platform.openai.com/docs/pricing
  "gpt-5.6-sol": { input: 1.0, output: 8.0 },
  "gpt-5.6-luna": { input: 0.2, output: 1.6 },
  "gpt-5.6-terra": { input: 0.5, output: 4.0 },
  "gpt-4.1": { input: 1.6, output: 6.4 },
  "gpt-4.1-mini": { input: 0.32, output: 1.28 },
  // Embeddings — input-only billing
  "text-embedding-3-large": { input: 0.104, output: 0 },
  "text-embedding-3-small": { input: 0.016, output: 0 },
  "voyage-3.5-lite": { input: 0.016, output: 0 },
  // keyless dev providers genuinely cost nothing
  "fake-llm": { input: 0, output: 0, verified: true },
  "fake-embeddings-1024": { input: 0, output: 0, verified: true },
};

/** Estimated £ for a call. Returns null when the model has no rate, so the
 *  caller can report it as uncosted instead of pretending it was free. */
export function estimateGbp(model: string, inputTokens: number, outputTokens: number): number | null {
  const rate = COST_PER_MTOK_GBP[model];
  if (!rate) return null;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

export const RETRIEVAL = {
  /** Candidates fetched per leg before fusion (§B7). */
  candidateK: 24,
  /** Results passed to generation after fusion. */
  finalK: 10,
  /** RRF constant (§B7). */
  rrfK: 60,
  /** Below this top RRF score, evidence is flagged weak. */
  weakEvidenceThreshold: 0.02,
} as const;

export const CHUNKING = {
  minTokens: 300,
  maxTokens: 800,
} as const;

/** Provenance versions recorded on every message (§B5 messages table). */
export const VERSIONS = {
  retrieval: "rrf-v1",
  prompt: "v1",
} as const;
