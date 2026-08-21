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
  /** USD per 1M input tokens, exactly as published by the provider */
  input: number;
  /** USD per 1M output tokens (0 for embedding models — input-only billing) */
  output: number;
  /** true when taken from the provider's published price list */
  verified?: boolean;
  /** where the figure came from, so it can be re-checked */
  source?: string;
}

/**
 * Prices are held in USD because that is the currency the providers publish
 * and bill in — converting at storage time would bake in a stale FX rate and
 * make the numbers impossible to reconcile against an invoice.
 */
const OPENAI_SRC = "developers.openai.com/api/docs/pricing, checked 2026-08-21";

export const COST_PER_MTOK_USD: Record<string, Rate> = {
  // OpenAI chat — standard tier
  "gpt-5.6-sol": { input: 5.0, output: 30.0, verified: true, source: OPENAI_SRC },
  "gpt-5.6-luna": { input: 0.2, output: 1.2, verified: true, source: OPENAI_SRC },
  "gpt-5.6-terra": { input: 2.0, output: 12.0, verified: true, source: OPENAI_SRC },
  "gpt-4.1": { input: 2.0, output: 8.0, verified: true, source: OPENAI_SRC },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, verified: true, source: OPENAI_SRC },
  // OpenAI embeddings — input-only billing
  "text-embedding-3-large": { input: 0.13, output: 0, verified: true, source: OPENAI_SRC },
  "text-embedding-3-small": { input: 0.02, output: 0, verified: true, source: OPENAI_SRC },
  // Anthropic / Voyage — only used if you switch provider; NOT yet checked
  // against a published price list, so they stay flagged as estimates.
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "voyage-3.5-lite": { input: 0.02, output: 0 },
  // keyless dev providers genuinely cost nothing
  "fake-llm": { input: 0, output: 0, verified: true, source: "no API call is made" },
  "fake-embeddings-1024": { input: 0, output: 0, verified: true, source: "no API call is made" },
};

/**
 * USD → GBP. The providers bill in USD, so this is the one genuinely moving
 * part of the estimate. Override with USD_TO_GBP when the rate drifts or to
 * match the rate your card issuer actually applied.
 */
export const USD_TO_GBP_FALLBACK = Number(process.env.USD_TO_GBP ?? 0.7323);

/** Estimated USD for a call, or null when the model has no published rate —
 *  so callers report it as uncosted rather than pretending it was free. */
export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const rate = COST_PER_MTOK_USD[model];
  if (!rate) return null;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

/** Estimated £ at a given FX rate. Null when the model has no published rate. */
export function estimateGbp(
  model: string,
  inputTokens: number,
  outputTokens: number,
  usdToGbp: number = USD_TO_GBP_FALLBACK,
): number | null {
  const usd = estimateUsd(model, inputTokens, outputTokens);
  return usd === null ? null : usd * usdToGbp;
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
