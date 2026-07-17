import { createHash } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { chunkThemes, chunks, documents, interviews, segments, themes, waves } from "@/db/schema";
import { audit } from "@/lib/audit";
import { dispatchDocumentApproved, dispatchDocumentUploaded } from "@/lib/ingestion/dispatch";
import { deleteDocumentData } from "@/lib/ingestion/pipeline";
import { DuplicateDocumentError, ForbiddenError, type SessionUser } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import type { SourceType } from "@/lib/parsers";

function requireResearcher(user: SessionUser): void {
  if (user.role === "viewer") throw new ForbiddenError("Requires researcher role");
}

/**
 * Registers an uploaded file as a document (§B6): computes the content hash,
 * enforces per-wave dedupe (§A4.2), assigns versions (nothing silently
 * overwritten), audits, and starts the pipeline.
 */
export async function registerUpload(params: {
  user: SessionUser;
  waveId: string;
  blobUrl: string;
  blobPathname: string;
  filename: string;
  mimeType: string;
  sourceType: SourceType;
  ip?: string | null;
}): Promise<{ documentId: string; version: number }> {
  const { user } = params;
  requireResearcher(user);

  const storage = getStorage();
  const buffer = await storage.get({ url: params.blobUrl, pathname: params.blobPathname });
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // dedupe: identical content already live in this wave (§A4.2)
  const [duplicate] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.waveId, params.waveId),
        eq(documents.sha256, sha256),
        ne(documents.status, "deleted"),
      ),
    );
  if (duplicate) {
    await storage.delete({ url: params.blobUrl, pathname: params.blobPathname });
    throw new DuplicateDocumentError(duplicate.id);
  }

  // same filename, different content → a new version superseding the old (§A4.2)
  const [previous] = await db
    .select({ id: documents.id, version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.waveId, params.waveId),
        eq(documents.filename, params.filename),
        ne(documents.status, "deleted"),
      ),
    )
    .orderBy(desc(documents.version))
    .limit(1);

  const [doc] = await db
    .insert(documents)
    .values({
      waveId: params.waveId,
      blobUrl: params.blobUrl,
      blobPathname: params.blobPathname,
      filename: params.filename,
      mimeType: params.mimeType,
      sha256,
      version: previous ? previous.version + 1 : 1,
      supersedes: previous?.id ?? null,
      sourceType: params.sourceType,
      status: "uploaded",
      uploadedBy: user.id,
    })
    .returning();

  await audit({
    userId: user.id,
    action: "upload",
    entityType: "document",
    entityId: doc.id,
    detail: { filename: params.filename, waveId: params.waveId, sourceType: params.sourceType, version: doc.version },
    ip: params.ip,
  });

  await dispatchDocumentUploaded(doc.id);
  return { documentId: doc.id, version: doc.version };
}

/** Approval (§B6.5): review gate opens, embedding starts. */
export async function approveDocument(user: SessionUser, documentId: string, ip?: string | null): Promise<void> {
  requireResearcher(user);
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw new Error("Document not found");
  if (doc.status !== "review") throw new Error(`Cannot approve a document in status '${doc.status}'`);

  await db.update(documents).set({ status: "approved" }).where(eq(documents.id, documentId));
  await audit({ userId: user.id, action: "approve", entityType: "document", entityId: documentId, ip });
  await dispatchDocumentApproved(documentId, user.id);
}

export async function rejectDocument(
  user: SessionUser,
  documentId: string,
  reason: string,
  ip?: string | null,
): Promise<void> {
  requireResearcher(user);
  await db
    .update(documents)
    .set({ status: "failed", error: `Rejected by reviewer: ${reason}` })
    .where(eq(documents.id, documentId));
  await audit({
    userId: user.id,
    action: "reject",
    entityType: "document",
    entityId: documentId,
    detail: { reason },
    ip,
  });
}

/** Deletion contract (§B5): file + chunks + tsv + embeddings, audited. */
export async function deleteDocument(user: SessionUser, documentId: string, ip?: string | null): Promise<void> {
  if (user.role !== "admin") throw new ForbiddenError("Requires admin role");
  await deleteDocumentData(documentId);
  await audit({ userId: user.id, action: "delete", entityType: "document", entityId: documentId, ip });
}

/** Review-gate chunk corrections (§B6 review UI). */
export async function updateChunkReview(
  user: SessionUser,
  chunkId: string,
  updates: {
    content?: string;
    speakerRole?: "moderator" | "consumer" | "mixed" | "n/a";
    evidenceType?: "direct_quote" | "researcher_summary" | "guide" | "context";
    segmentId?: string | null;
    interviewId?: string | null;
    themeIds?: string[];
    clearPiiSuggestions?: boolean;
  },
): Promise<void> {
  requireResearcher(user);
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, chunkId));
  if (!chunk) throw new Error("Chunk not found");
  const [doc] = await db.select().from(documents).where(eq(documents.id, chunk.documentId));
  if (!doc || (doc.status !== "review" && doc.status !== "failed")) {
    throw new Error("Chunks can only be edited while the document is in review");
  }

  const set: Partial<typeof chunks.$inferInsert> = {};
  if (updates.content !== undefined) {
    set.content = updates.content; // PII redaction rewrites chunk content (§B6); the original file is untouched
    set.tokenCount = Math.ceil(updates.content.split(/\s+/).filter(Boolean).length * 1.33);
  }
  if (updates.speakerRole !== undefined) set.speakerRole = updates.speakerRole;
  if (updates.evidenceType !== undefined) set.evidenceType = updates.evidenceType;
  if (updates.segmentId !== undefined) set.segmentId = updates.segmentId;
  if (updates.interviewId !== undefined) set.interviewId = updates.interviewId;
  if (updates.clearPiiSuggestions) set.piiSuggestions = null;
  if (Object.keys(set).length > 0) {
    await db.update(chunks).set(set).where(eq(chunks.id, chunkId));
  }

  if (updates.themeIds !== undefined) {
    await db.delete(chunkThemes).where(eq(chunkThemes.chunkId, chunkId));
    for (const themeId of updates.themeIds) {
      await db
        .insert(chunkThemes)
        .values({ chunkId, themeId, source: "human", confidence: null })
        .onConflictDoNothing();
    }
  }
}

export async function getReviewQueue() {
  // warning-carrying documents first: reviewer attention goes where extraction
  // is least trustworthy (§B6)
  return db
    .select({
      id: documents.id,
      filename: documents.filename,
      sourceType: documents.sourceType,
      status: documents.status,
      parseWarnings: documents.parseWarnings,
      createdAt: documents.createdAt,
      waveId: documents.waveId,
      waveLabel: sql<string>`${waves.year} || '-' || lpad(${waves.month}::text, 2, '0')`,
    })
    .from(documents)
    .innerJoin(waves, eq(documents.waveId, waves.id))
    .where(eq(documents.status, "review"))
    .orderBy(
      sql`CASE WHEN ${documents.parseWarnings} IS NOT NULL THEN 0 ELSE 1 END`,
      desc(documents.createdAt),
    );
}

export async function getDocumentWithChunks(user: SessionUser, documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return null;

  // §B9.2: raw transcript content requires transcript_access
  if (doc.sourceType === "transcript" && !user.transcriptAccess) {
    throw new ForbiddenError("Transcript access required");
  }

  const docChunks = await db
    .select({
      id: chunks.id,
      seq: chunks.seq,
      content: chunks.content,
      tokenCount: chunks.tokenCount,
      speakerRole: chunks.speakerRole,
      evidenceType: chunks.evidenceType,
      sectionPath: chunks.sectionPath,
      pageRef: chunks.pageRef,
      segmentId: chunks.segmentId,
      segmentName: segments.name,
      interviewId: chunks.interviewId,
      interviewRef: interviews.externalRef,
      piiSuggestions: chunks.piiSuggestions,
      embedded: sql<boolean>`${chunks.embedding} IS NOT NULL`,
    })
    .from(chunks)
    .leftJoin(segments, eq(chunks.segmentId, segments.id))
    .leftJoin(interviews, eq(chunks.interviewId, interviews.id))
    .where(eq(chunks.documentId, documentId))
    .orderBy(chunks.seq);

  const themeRows = await db
    .select({ chunkId: chunkThemes.chunkId, themeId: chunkThemes.themeId, name: themes.name, source: chunkThemes.source, confidence: chunkThemes.confidence })
    .from(chunkThemes)
    .innerJoin(themes, eq(chunkThemes.themeId, themes.id))
    .where(
      sql`${chunkThemes.chunkId} IN (SELECT id FROM chunks WHERE document_id = ${documentId})`,
    );

  const themesByChunk = new Map<string, typeof themeRows>();
  for (const row of themeRows) {
    const list = themesByChunk.get(row.chunkId) ?? [];
    list.push(row);
    themesByChunk.set(row.chunkId, list);
  }

  return {
    document: doc,
    chunks: docChunks.map((c) => ({ ...c, themes: themesByChunk.get(c.id) ?? [] })),
  };
}
