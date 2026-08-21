import { sql } from "drizzle-orm";
import { db } from "@/db";
import { COST_PER_MTOK_USD } from "@/lib/config";
import { getUsdToGbp } from "@/lib/fx";

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
           coalesce(sum(est_cost_usd), 0)::numeric AS est_cost_usd
    FROM ai_usage
    GROUP BY day, model, kind
    ORDER BY day DESC, est_cost_usd DESC
    LIMIT 120
  `)) as unknown as Record<string, string>[];

  const byFeature = (await db.execute(sql`
    SELECT feature,
           kind,
           count(*)::int AS calls,
           coalesce(sum(input_tokens + output_tokens), 0)::bigint AS tokens,
           coalesce(sum(est_cost_usd), 0)::numeric AS est_cost_usd
    FROM ai_usage
    GROUP BY feature, kind
    ORDER BY est_cost_usd DESC
  `)) as unknown as Record<string, string>[];

  const [totals] = (await db.execute(sql`
    SELECT count(*)::int AS calls,
           coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
           coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
           coalesce(sum(est_cost_usd), 0)::numeric AS est_cost_usd,
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

  const fx = await getUsdToGbp();
  const n = (v: unknown) => Number(v ?? 0);
  /** every figure reported to the UI is £, converted at today's rate */
  const gbp = (v: unknown) => Number(v ?? 0) * fx.rate;

  return {
    byDay: byDay.map((r) => ({
      day: r.day,
      model: r.model,
      kind: r.kind,
      calls: n(r.calls),
      inputTokens: n(r.input_tokens),
      outputTokens: n(r.output_tokens),
      estCostGbp: gbp(r.est_cost_usd),
    })),
    byFeature: byFeature.map((r) => ({
      feature: r.feature,
      kind: r.kind,
      calls: n(r.calls),
      tokens: n(r.tokens),
      estCostGbp: gbp(r.est_cost_usd),
    })),
    totals: {
      calls: n(totals?.calls),
      inputTokens: n(totals?.input_tokens),
      outputTokens: n(totals?.output_tokens),
      estCostGbp: gbp(totals?.est_cost_usd),
      chatGbp: gbp(totals?.chat_usd),
      embeddingGbp: gbp(totals?.embedding_usd),
      monthGbp: gbp(totals?.month_usd),
      last30Gbp: gbp(totals?.last30_usd),
    },
    uncostedModels,
    /** the rate card the £ figures were derived from, so they're auditable */
    rates: Object.entries(COST_PER_MTOK_USD).map(([model, r]) => ({
      model,
      inputUsd: r.input,
      outputUsd: r.output,
      inputGbp: r.input * fx.rate,
      outputGbp: r.output * fx.rate,
      verified: Boolean(r.verified),
      source: r.source ?? null,
    })),
    fx: {
      rate: fx.rate,
      date: fx.date,
      live: fx.live,
      note: fx.live
        ? `USD→GBP ${fx.rate.toFixed(4)} — ECB reference rate for ${fx.date}`
        : `USD→GBP ${fx.rate.toFixed(4)} — live rate unavailable, using last known value`,
    },
    retrieval: { searches: n(retrieval?.searches), weakSearches: n(retrieval?.weak_searches) },
    ingestion: { documents: n(ingestion?.documents) },
  };
}
