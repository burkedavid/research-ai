import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, users, waves } from "@/db/schema";
import { registerUpload } from "@/lib/services/documents";
import type { SessionUser } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { buildReportDocx } from "@/lib/seed/build-files";
import { CORPUS_WAVES, renderTranscript, type CorpusWave } from "@/lib/seed/corpus";
import type { SourceType } from "@/lib/parsers";

export { CORPUS_WAVES };

export async function getUser(email: string): Promise<SessionUser> {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  if (!row) throw new Error(`Test user ${email} not seeded`);
  return { id: row.id, email: row.email, name: row.name, role: row.role, transcriptAccess: row.transcriptAccess };
}

export const researcher = () => getUser("researcher@example.com");
export const admin = () => getUser("admin@example.com");
export const summaryOnly = () => getUser("summary-only@example.com");
export const viewer = () => getUser("viewer@example.com");

export async function getProjectId(): Promise<string> {
  const [project] = await db.select().from(projects).limit(1);
  return project.id;
}

export async function createTestWave(corpusWave: CorpusWave): Promise<string> {
  const projectId = await getProjectId();
  // Scope by project AND period, not by wave number alone. Wave numbers are
  // unique only within a project (the DB uniqueness is on project+year+month),
  // so an unscoped lookup can return another project's wave and file a whole
  // wave's corpus under the wrong project and date — which is exactly how the
  // 2020 corpus once ended up inside a 2026 wave, silently breaking retrieval
  // ordering for every test that ran afterwards.
  const existing = await db
    .select()
    .from(waves)
    .where(
      and(
        eq(waves.projectId, projectId),
        eq(waves.year, corpusWave.year),
        eq(waves.month, corpusWave.month),
      ),
    );
  if (existing.length > 0) return existing[0].id;
  const [wave] = await db
    .insert(waves)
    .values({
      projectId,
      waveNumber: corpusWave.waveNumber,
      month: corpusWave.month,
      year: corpusWave.year,
      keyEvents: [...corpusWave.keyEvents],
    })
    .returning();
  return wave.id;
}

/** Store a buffer and register it as a document (runs the inline pipeline). */
export async function uploadBuffer(params: {
  user: SessionUser;
  waveId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sourceType: SourceType;
}): Promise<string> {
  const pathname = `uploads/${randomUUID()}/${params.filename}`;
  const stored = await getStorage().put(pathname, params.buffer, params.mimeType);
  const { documentId } = await registerUpload({
    user: params.user,
    waveId: params.waveId,
    blobUrl: stored.url,
    blobPathname: stored.pathname,
    filename: params.filename,
    mimeType: params.mimeType,
    sourceType: params.sourceType,
  });
  return documentId;
}

/** Store a buffer and register it via the auto-date path (item 2). */
export async function uploadBufferAutoDated(params: {
  user: SessionUser;
  autoDateProjectId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sourceType: SourceType;
}): Promise<{ documentId: string; waveId: string; reportDate: string | null }> {
  const pathname = `uploads/${randomUUID()}/${params.filename}`;
  const stored = await getStorage().put(pathname, params.buffer, params.mimeType);
  const { documentId, waveId, reportDate } = await registerUpload({
    user: params.user,
    autoDateProjectId: params.autoDateProjectId,
    blobUrl: stored.url,
    blobPathname: stored.pathname,
    filename: params.filename,
    mimeType: params.mimeType,
    sourceType: params.sourceType,
  });
  return { documentId, waveId, reportDate };
}

/**
 * Idempotently ingest + approve the whole synthetic corpus (3 waves).
 * Safe to call from any test file in any order: duplicate uploads are
 * tolerated and pending reviews are approved.
 */
export async function ensureCorpusIngested(): Promise<void> {
  const user = await researcher();
  const { documents } = await import("@/db/schema");
  const { approveDocument } = await import("@/lib/services/documents");

  for (const corpusWave of CORPUS_WAVES) {
    const waveId = await createTestWave(corpusWave);
    for (const interview of corpusWave.interviews) {
      await uploadBuffer({
        user,
        waveId,
        buffer: Buffer.from(renderTranscript(interview), "utf-8"),
        filename: `transcript-${interview.externalRef}.txt`,
        mimeType: "text/plain",
        sourceType: "transcript",
      }).catch((err) => {
        if (!String(err).includes("identical file")) throw err;
      });
    }
    await uploadBuffer({
      user,
      waveId,
      buffer: await buildReportDocx(corpusWave),
      filename: `report-${corpusWave.year}-${corpusWave.month}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceType: "report",
    }).catch((err) => {
      if (!String(err).includes("identical file")) throw err;
    });

    const pending = await db.select().from(documents).where(eq(documents.waveId, waveId));
    for (const doc of pending) {
      if (doc.status === "review") await approveDocument(user, doc.id);
    }
  }
}

/** Upload a full corpus wave: 6 transcripts + 1 report. Returns document ids. */
export async function uploadCorpusWave(user: SessionUser, corpusWave: CorpusWave, waveId: string) {
  const ids: { transcripts: string[]; report: string } = { transcripts: [], report: "" };
  for (const interview of corpusWave.interviews) {
    ids.transcripts.push(
      await uploadBuffer({
        user,
        waveId,
        buffer: Buffer.from(renderTranscript(interview), "utf-8"),
        filename: `transcript-${interview.externalRef}.txt`,
        mimeType: "text/plain",
        sourceType: "transcript",
      }),
    );
  }
  ids.report = await uploadBuffer({
    user,
    waveId,
    buffer: await buildReportDocx(corpusWave),
    filename: `report-${corpusWave.year}-${corpusWave.month}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sourceType: "report",
  });
  return ids;
}
