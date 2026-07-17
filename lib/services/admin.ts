import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Usage & cost summary (§B8 /admin): everything derives from messages.usage,
 *  documents.ingest_usage and retrieval_log — no extra tracking schema. */
export async function getUsageSummary() {
  const byDay = (await db.execute(sql`
    SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
           model,
           count(*)::int AS messages,
           coalesce(sum((usage->>'input_tokens')::bigint), 0)::bigint AS input_tokens,
           coalesce(sum((usage->>'output_tokens')::bigint), 0)::bigint AS output_tokens,
           coalesce(sum((usage->>'est_cost_gbp')::numeric), 0)::numeric AS est_cost_gbp
    FROM messages
    WHERE role = 'assistant' AND usage IS NOT NULL
    GROUP BY day, model
    ORDER BY day DESC
    LIMIT 60
  `)) as unknown as { day: string; model: string; messages: number; input_tokens: string; output_tokens: string; est_cost_gbp: string }[];

  const [retrieval] = (await db.execute(sql`
    SELECT count(*)::int AS searches,
           count(*) FILTER (WHERE weak_evidence)::int AS weak_searches
    FROM retrieval_log
  `)) as unknown as { searches: number; weak_searches: number }[];

  const [ingestion] = (await db.execute(sql`
    SELECT count(*)::int AS documents,
           coalesce(sum((ingest_usage->>'inputTokens')::bigint), 0)::bigint AS input_tokens,
           coalesce(sum((ingest_usage->>'outputTokens')::bigint), 0)::bigint AS output_tokens
    FROM documents
    WHERE ingest_usage IS NOT NULL
  `)) as unknown as { documents: number; input_tokens: string; output_tokens: string }[];

  return {
    byDay: byDay.map((r) => ({
      day: r.day,
      model: r.model,
      messages: Number(r.messages),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      estCostGbp: Number(r.est_cost_gbp),
    })),
    retrieval: { searches: Number(retrieval?.searches ?? 0), weakSearches: Number(retrieval?.weak_searches ?? 0) },
    ingestion: {
      documents: Number(ingestion?.documents ?? 0),
      inputTokens: Number(ingestion?.input_tokens ?? 0),
      outputTokens: Number(ingestion?.output_tokens ?? 0),
    },
  };
}
