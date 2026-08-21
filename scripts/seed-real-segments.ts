import "./load-env";
import { randomUUID } from "node:crypto";

/**
 * Seed report-shaped demo content covering all twelve REAL Fresco segments, so
 * the Segment Observatory has evidence for every segment (the synthetic corpus
 * only covers its own six invented ones). Idempotent: re-uploading identical
 * content is refused by the hash dedupe, which we tolerate.
 */
async function main() {
  const { db } = await import("@/db");
  const { documents, projects } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { getStorage } = await import("@/lib/storage");
  const { registerUpload, approveDocument } = await import("@/lib/services/documents");
  const { buildRealSegmentReport } = await import("@/lib/seed/real-segment-corpus");
  const { getUser } = await import("../tests/helpers");

  const user = await getUser("researcher@example.com");
  const [project] = await db.select().from(projects).limit(1);
  if (!project) throw new Error("No project seeded — run npm run db:seed first");

  // a spread of months so trends/compare have something to move between
  const periods: [number, number, number][] = [
    [2025, 9, 2],
    [2025, 12, 3],
    [2026, 3, 4],
    [2026, 6, 5],
  ];

  const ids: string[] = [];
  for (const [year, month, day] of periods) {
    const buffer = await buildRealSegmentReport(year, month);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const yy = String(year).slice(2);
    const filename = `Consumer Sentiment - Summary Report ${dd}.${mm}.${yy}.docx`;
    const pathname = `uploads/${randomUUID()}/${filename}`;
    const stored = await getStorage().put(
      pathname,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    try {
      const { documentId, reportDate } = await registerUpload({
        user,
        autoDateProjectId: project.id,
        blobUrl: stored.url,
        blobPathname: stored.pathname,
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sourceType: "report",
      });
      ids.push(documentId);
      console.log(`UPLOADED ${filename} reportDate=${reportDate}`);
    } catch (err) {
      if (String(err).includes("identical file")) {
        console.log(`SKIPPED (already ingested) ${filename}`);
        continue;
      }
      throw err;
    }
  }

  for (const id of ids) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (doc?.status === "review") {
      await approveDocument(user, id);
      console.log(`APPROVED ${doc.filename}`);
    }
  }

  console.log("REAL_SEGMENT_CORPUS_DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
