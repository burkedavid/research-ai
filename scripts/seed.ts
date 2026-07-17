import "./load-env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, segments, themes, users } from "@/db/schema";
import { buildReportDocx } from "@/lib/seed/build-files";
import { CORPUS_WAVES, FRESCO_SEGMENTS, THEMES, renderTranscript } from "@/lib/seed/corpus";

/**
 * Seeds reference data (users, client, project, segments, themes) and writes
 * the synthetic corpus files to seed-corpus/ for upload through the UI or the
 * ingestion tests. Idempotent: safe to run repeatedly.
 *
 * Dev login password for all seeded users: "dev-password".
 */
async function seedUsers() {
  const rows = [
    { email: "admin@example.com", name: "Alex Admin", role: "admin" as const, transcriptAccess: true },
    { email: "researcher@example.com", name: "Riley Researcher", role: "researcher" as const, transcriptAccess: true },
    {
      email: "summary-only@example.com",
      name: "Sam Summary",
      role: "researcher" as const,
      transcriptAccess: false,
    },
    { email: "viewer@example.com", name: "Vic Viewer", role: "viewer" as const, transcriptAccess: false },
  ];
  for (const row of rows) {
    await db.insert(users).values(row).onConflictDoUpdate({
      target: users.email,
      set: { role: row.role, transcriptAccess: row.transcriptAccess, active: true },
    });
  }
  console.log(`Seeded ${rows.length} users`);
}

async function seedTaxonomy() {
  for (const seg of FRESCO_SEGMENTS) {
    await db.insert(segments).values(seg).onConflictDoNothing();
  }
  for (const name of THEMES) {
    await db.insert(themes).values({ name }).onConflictDoNothing();
  }
  console.log(`Seeded ${FRESCO_SEGMENTS.length} segments, ${THEMES.length} themes`);
}

async function seedProject(): Promise<string> {
  let [client] = await db.select().from(clients).where(eq(clients.name, "Fresco Insight (synthetic)"));
  if (!client) {
    [client] = await db
      .insert(clients)
      .values({ name: "Fresco Insight (synthetic)", notes: "Synthetic seed client — not real data" })
      .returning();
  }
  let [project] = await db.select().from(projects).where(eq(projects.clientId, client.id));
  if (!project) {
    [project] = await db
      .insert(projects)
      .values({ clientId: client.id, name: "Consumer Sentiment Monitor", lawfulBasis: "Legitimate interest (synthetic data)" })
      .returning();
  }
  console.log(`Seeded client + project ${project.id}`);
  return project.id;
}

async function writeCorpusFiles() {
  const root = path.join(process.cwd(), "seed-corpus");
  for (const wave of CORPUS_WAVES) {
    const dir = path.join(root, `wave-${String(wave.waveNumber).padStart(2, "0")}-${wave.year}-${String(wave.month).padStart(2, "0")}`);
    await mkdir(dir, { recursive: true });
    for (const interview of wave.interviews) {
      await writeFile(path.join(dir, `transcript-${interview.externalRef}.txt`), renderTranscript(interview));
    }
    const docx = await buildReportDocx(wave);
    await writeFile(path.join(dir, `report-${wave.year}-${String(wave.month).padStart(2, "0")}.docx`), docx);
  }
  console.log(`Wrote corpus files to ${root}`);
}

async function main() {
  await seedUsers();
  await seedTaxonomy();
  await seedProject();
  await writeCorpusFiles();
  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
