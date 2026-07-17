import { existsSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, chunkThemes, chunks, documents, interviews } from "@/db/schema";
import { approveDocument, deleteDocument } from "@/lib/services/documents";
import {
  CORPUS_WAVES,
  admin,
  createTestWave,
  researcher,
  uploadBuffer,
  uploadCorpusWave,
} from "./helpers";

describe("ingestion pipeline end-to-end (§B10.2)", () => {
  let waveId: string;
  let transcriptDocId: string;
  let reportDocId: string;

  beforeAll(async () => {
    const user = await researcher();
    // a dedicated 1990 wave so this file never collides with the golden-question
    // corpus waves, whichever order vitest runs files in
    waveId = await createTestWave({ ...CORPUS_WAVES[1], waveNumber: 901, year: 1990 });
    const ids = await uploadCorpusWave(user, CORPUS_WAVES[1], waveId);
    transcriptDocId = ids.transcripts[1]; // Budgeting Elderly
    reportDocId = ids.report;
  });

  it("parses and chunks into review status with suggestions stored, not live", async () => {
    const [doc] = await db.select().from(documents).where(eq(documents.id, transcriptDocId));
    expect(doc.status).toBe("review");

    const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, transcriptDocId));
    expect(docChunks.length).toBeGreaterThan(0);
    for (const chunk of docChunks) {
      expect(chunk.embedding).toBeNull(); // nothing indexed before approval (§B6.4)
      expect(chunk.speakerRole).toBe("mixed");
      expect(chunk.evidenceType).toBe("direct_quote");
      expect(chunk.waveId).toBe(waveId);
    }
  });

  it("maps transcript to pseudonymised interview with segment and demographics (§B6.3, §A13.2)", async () => {
    const [chunk] = await db.select().from(chunks).where(eq(chunks.documentId, transcriptDocId)).limit(1);
    expect(chunk.interviewId).toBeTruthy();
    expect(chunk.segmentId).toBeTruthy();
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, chunk.interviewId!));
    expect(interview.externalRef).toBe("BE_M_10_2022");
    expect(interview.age).toBe(72);
    expect(interview.region).toBe("Midlands");
  });

  it("suggests themes from the controlled taxonomy (ai_suggested with confidence)", async () => {
    const rows = await db
      .select({ source: chunkThemes.source, confidence: chunkThemes.confidence })
      .from(chunkThemes)
      .innerJoin(chunks, eq(chunkThemes.chunkId, chunks.id))
      .where(eq(chunks.documentId, transcriptDocId));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.source).toBe("ai_suggested");
      expect(row.confidence).toBeGreaterThan(0);
    }
  });

  it("report chunks carry section paths from the docx heading hierarchy", async () => {
    const rows = await db.select().from(chunks).where(eq(chunks.documentId, reportDocId));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((c) => c.evidenceType === "researcher_summary")).toBe(true);
    expect(rows.some((c) => c.sectionPath?.includes("Energy and fuel"))).toBe(true);
  });

  it("approval embeds every chunk and sets status indexed (§B6.5)", async () => {
    const user = await researcher();
    await approveDocument(user, transcriptDocId);
    const [doc] = await db.select().from(documents).where(eq(documents.id, transcriptDocId));
    expect(doc.status).toBe("indexed");
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(sql`${chunks.documentId} = ${transcriptDocId} AND ${chunks.embedding} IS NULL`);
    expect(row.count).toBe(0);
  });

  it("rejects duplicate content per wave (§A4.2 dedupe)", async () => {
    const user = await researcher();
    const interview = CORPUS_WAVES[1].interviews[1];
    const { renderTranscript } = await import("@/lib/seed/corpus");
    await expect(
      uploadBuffer({
        user,
        waveId,
        buffer: Buffer.from(renderTranscript(interview), "utf-8"),
        filename: "duplicate-upload.txt",
        mimeType: "text/plain",
        sourceType: "transcript",
      }),
    ).rejects.toThrow(/identical file/i);
  });

  it("same filename with different content becomes a new version, nothing overwritten (§A4.2)", async () => {
    const user = await researcher();
    const filename = "versioned.txt";
    const v1 = await uploadBuffer({
      user,
      waveId,
      buffer: Buffer.from("MOD: One?\n\nR: First version answer here.", "utf-8"),
      filename,
      mimeType: "text/plain",
      sourceType: "transcript",
    });
    const v2 = await uploadBuffer({
      user,
      waveId,
      buffer: Buffer.from("MOD: One?\n\nR: Second version answer here.", "utf-8"),
      filename,
      mimeType: "text/plain",
      sourceType: "transcript",
    });
    const [doc1] = await db.select().from(documents).where(eq(documents.id, v1));
    const [doc2] = await db.select().from(documents).where(eq(documents.id, v2));
    expect(doc1.version).toBe(1);
    expect(doc2.version).toBe(2);
    expect(doc2.supersedes).toBe(v1);
    expect(doc1.status).not.toBe("deleted");
  });

  it("audit log recorded uploads and approval (§B9.3)", async () => {
    const uploads = await db.select().from(auditLog).where(eq(auditLog.action, "upload"));
    expect(uploads.length).toBeGreaterThanOrEqual(7);
    const approvals = await db.select().from(auditLog).where(eq(auditLog.action, "approve"));
    expect(approvals.some((a) => a.entityId === transcriptDocId)).toBe(true);
  });
});

describe("deletion contract (§B5, acceptance criterion 8)", () => {
  it("removes file, chunks, tsv and embeddings in one operation, audited", async () => {
    const user = await researcher();
    const adminUser = await admin();
    const waveId = await createTestWave({ ...CORPUS_WAVES[0], waveNumber: 902, year: 1991 });
    const docId = await uploadBuffer({
      user,
      waveId,
      buffer: Buffer.from("MOD: Question about deletion?\n\nR: This content is destined for deletion testing.", "utf-8"),
      filename: "to-delete.txt",
      mimeType: "text/plain",
      sourceType: "transcript",
    });
    await approveDocument(user, docId);

    const [before] = await db.select().from(documents).where(eq(documents.id, docId));
    const storedPath = path.join(process.cwd(), ".storage", before.blobPathname);
    expect(existsSync(storedPath)).toBe(true);
    const chunksBefore = await db.select().from(chunks).where(eq(chunks.documentId, docId));
    expect(chunksBefore.length).toBeGreaterThan(0);

    await deleteDocument(adminUser, docId);

    const [after] = await db.select().from(documents).where(eq(documents.id, docId));
    expect(after.status).toBe("deleted");
    expect(existsSync(storedPath)).toBe(false); // blob gone
    const chunksAfter = await db.select().from(chunks).where(eq(chunks.documentId, docId));
    expect(chunksAfter).toEqual([]); // text + tsv + embeddings gone in one operation
    const audits = await db.select().from(auditLog).where(eq(auditLog.action, "delete"));
    expect(audits.some((a) => a.entityId === docId)).toBe(true);
  });

  it("only admins can delete", async () => {
    const user = await researcher();
    await expect(deleteDocument(user, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/admin/i);
  });
});
