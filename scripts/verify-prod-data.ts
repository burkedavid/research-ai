import { sql } from "drizzle-orm";
import { db } from "@/db";

async function main() {
  const [r] = (await db.execute(sql`
    SELECT (SELECT count(*)::int FROM documents WHERE status='indexed') AS indexed,
           (SELECT count(*)::int FROM chunks WHERE embedding IS NOT NULL) AS embedded,
           (SELECT count(*)::int FROM chunks WHERE evidence_type='direct_quote') AS quotes,
           (SELECT count(*)::int FROM waves) AS waves,
           (SELECT count(*)::int FROM interviews) AS interviews
  `)) as unknown as Record<string, number>[];
  console.log("RESULT", JSON.stringify(r));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
