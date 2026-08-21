import { sql } from "drizzle-orm";
import { db } from "@/db";
import { COST_PER_MTOK_USD, FX_NOTE, USD_TO_GBP } from "@/lib/config";

/**
 * Complete AI spend picture (§B8 admin): EVERY billable call — chat and
 * embeddings, user-facing and ingestion — read from the ai_usage ledger.
 * Token counts are exact (straight from provider responses); the £ figures
 * are derived from the rate table, so unpriced models are reported separately
 * rather than silently counted as free.
 */
export async function getUsageSummary() {
  const byDay = (await db.execute(sql`
    SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
           model,
           kind,
           count(*)::int AS calls,
           coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
           coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
           coalesce(sum(est_cost_gbp), 0)::numeric AS est_cost_gbp
    FROM ai_usage
    GROUP BY day, model, kind
    ORDER BY day DESC, est_cost_gbp DESC
    LIMIT 120
  `)) as unknown as Record<string, string>[];

  const byFeature = (await db.execute(sql`
    SELECT feature,
           kind,
           count(*)::int AS calls,
           coalesce(sum(input_tokens + output_tokens), 0)::bigint AS tokens,
           coalesce(sum(est_cost_gbp), 0)::numeric AS est_cost_gbp
    FROM ai_usage
    GROUP BY feature, kind
    ORDER BY est_cost_gbp DESC
  `)) as unknown as Record<string, string>[];

  const [totals] = (await db.execute(sql`
    SELECT count(*)::int AS calls,
           coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
           coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
           coalesce(sum(est_cost_gbp), 0)::numeric AS est_cost_gbp,
           coalesce(sum(est_cost_gbp) FILTER (WHERE kind = 'chat'), 0)::numeric AS chat_gbp,
           coalesce(sum(est_cost_gbp) FILTER (WHERE kind = 'embedding'), 0)::numeric AS embedding_gbp,
           coalesce(sum(est_cost_gbp) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::numeric AS month_gbp,
           coalesce(sum(est_cost_gbp) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::numeric AS last30_gbp
    FROM ai_usage
  `)) as unknown as Record<string, string>[];

  // models seen in the ledger that have no rate — their spend is unknown, and
  // saying "£0" would understate the budget
  const models = (await db.execute(sql`SELECT DISTINCT model FROM ai_usage`)) as unknown as { model: string }[];
  const uncostedModels = models.map((m) => m.model).filter((m) => !COST_PER_MTOK_USD[m]);

  const [retrieval] = (await db.execute(sql`
    SELECT count(*)::int AS searches,
           count(*) FILTER (WHERE weak_evidence)::int AS weak_searches
    FROM retrieval_log
  `)) as unknown as { searches: number; weak_searches: number }[];

  const [ingestion] = (await db.execute(sql`
    SELECT count(*)::int AS documents FROM documents WHERE status = 'indexed'
  `)) as unknown as { documents: number }[];

  const n = (v: unknown) => Number(v ?? 0);

  return {
    byDay: byDay.map((r) => ({
      day: r.day,
      model: r.model,
      kind: r.kind,
      calls: n(r.calls),
      inputTokens: n(r.input_tokens),
      outputTokens: n(r.output_tokens),
      estCostGbp: n(r.est_cost_gbp),
    })),
    byFeature: byFeature.map((r) => ({
      feature: r.feature,
      kind: r.kind,
      calls: n(r.calls),
      tokens: n(r.tokens),
      estCostGbp: n(r.est_cost_gbp),
    })),
    totals: {
      calls: n(totals?.calls),
      inputTokens: n(totals?.input_tokens),
      outputTokens: n(totals?.output_tokens),
      estCostGbp: n(totals?.est_cost_gbp),
      chatGbp: n(totals?.chat_gbp),
      embeddingGbp: n(totals?.embedding_gbp),
      monthGbp: n(totals?.month_gbp),
      last30Gbp: n(totals?.last30_gbp),
    },
    uncostedModels,
    /** the rate card the £ figures were derived from, so they're auditable */
    rates: Object.entries(COST_PER_MTOK_USD).map(([model, r]) => ({
      model,
      inputUsd: r.input,
      outputUsd: r.output,
      inputGbp: r.input * USD_TO_GBP,
      outputGbp: r.output * USD_TO_GBP,
      verified: Boolean(r.verified),
      source: r.source ?? null,
    })),
    fxNote: FX_NOTE,
    retrieval: { searches: n(retrieval?.searches), weakSearches: n(retrieval?.weak_searches) },
    ingestion: { documents: n(ingestion?.documents) },
  };
}
