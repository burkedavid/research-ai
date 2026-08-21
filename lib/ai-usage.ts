import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { estimateUsd } from "@/lib/config";

export type UsageKind = "chat" | "embedding";
export type UsageFeature =
  | "ask"
  | "quotes"
  | "compare"
  | "report"
  | "trends"
  | "ingest_suggest"
  | "ingest_embed"
  | "search_query"
  | "reembed";

/**
 * Record one billable AI call. EVERY provider call — chat completion or
 * embedding — must go through here, otherwise the admin cost summary
 * understates real spend and can't be used for budgeting.
 *
 * Token counts are taken from the provider response and are exact; the cost
 * is derived from the published rate table (0 when the model has no rate —
 * such models are surfaced as uncosted in the admin summary, never as free).
 *
 * Never throws: a ledger failure must not take down the user's request, but
 * it is logged so the gap is visible.
 */
export async function recordAiUsage(params: {
  kind: UsageKind;
  model: string;
  feature: UsageFeature;
  inputTokens: number;
  outputTokens?: number;
  userId?: string | null;
  documentId?: string | null;
}): Promise<void> {
  try {
    const outputTokens = params.outputTokens ?? 0;
    // store the provider's own currency; £ is derived at display time with the
    // day's FX rate so reported spend is always in today's money
    const usd = estimateUsd(params.model, params.inputTokens, outputTokens);
    await db.insert(aiUsage).values({
      kind: params.kind,
      model: params.model,
      feature: params.feature,
      inputTokens: params.inputTokens,
      outputTokens,
      estCostUsd: String(usd ?? 0),
      userId: params.userId ?? null,
      documentId: params.documentId ?? null,
    });
  } catch (err) {
    console.error("AI_USAGE_WRITE_FAILED", err instanceof Error ? err.name : "unknown");
  }
}

/**
 * Approximate token count for text we embed with a provider that doesn't
 * report usage. ~4 characters per token is the standard rule of thumb for
 * English; only used as a fallback so embedding spend is never invisible.
 */
export function approxTokens(texts: string[]): number {
  return Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4);
}
