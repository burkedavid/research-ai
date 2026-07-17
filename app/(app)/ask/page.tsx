import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getFilterOptions } from "@/lib/services/filter-options";
import { requireUser } from "@/lib/session";
import { AskClient } from "./ask-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask the Archive" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const options = await getFilterOptions();
  const { q } = await searchParams;

  const [stats] = (await db.execute(sql`
    SELECT (SELECT count(*)::int FROM waves) AS waves,
           (SELECT count(*)::int FROM chunks c JOIN documents d ON d.id = c.document_id
             WHERE d.status = 'indexed') AS passages
  `)) as unknown as { waves: number; passages: number }[];

  return (
    <AskClient
      options={options}
      initialQuestion={q}
      archiveStats={{ waves: Number(stats.waves), passages: Number(stats.passages) }}
    />
  );
}
