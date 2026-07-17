import "./load-env";
import { isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";

/**
 * Backfill AI-assessed sentiment (F2) onto chunks ingested before the feature
 * existed. Uses the same heuristic as fake-mode ingest, so it's deterministic
 * and key-free. Safe to re-run (only touches rows where sentiment IS NULL).
 */
async function main() {
  const { db } = await import("@/db");
  const { chunks } = await import("@/db/schema");
  const { heuristicSentiment } = await import("@/lib/ingestion/suggest");

  const rows = await db.select({ id: chunks.id, content: chunks.content }).from(chunks).where(isNull(chunks.sentiment));
  let updated = 0;
  for (const row of rows) {
    await db.update(chunks).set({ sentiment: heuristicSentiment(row.content) }).where(eq(chunks.id, row.id));
    updated++;
  }
  console.log(`BACKFILL_DONE updated=${updated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
