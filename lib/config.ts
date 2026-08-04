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
  query: "gpt-4.1",
  ingestion: "gpt-4.1-mini",
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

/** Rough £/1M tokens for the admin cost summary — estimates, not billing. */
export const COST_PER_MTOK_GBP: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 2.4, output: 12.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  // OpenAI (approx GBP; update if you change OPENAI_MODELS)
  "gpt-4.1": { input: 1.6, output: 6.4 },
  "gpt-4.1-mini": { input: 0.32, output: 1.28 },
  "fake-llm": { input: 0, output: 0 },
};

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
