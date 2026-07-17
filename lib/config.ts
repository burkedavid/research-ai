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

export const EMBEDDING = {
  model: "voyage-3.5-lite",
  dimensions: 1024,
} as const;

/** Rough £/1M tokens for the admin cost summary — estimates, not billing. */
export const COST_PER_MTOK_GBP: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 2.4, output: 12.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
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
