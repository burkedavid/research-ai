import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { chunkThemes, chunks, documents, interviews, segments, themeProposals, themes } from "@/db/schema";
import { recordAiUsage } from "@/lib/ai-usage";
import { getEmbeddings } from "@/lib/embeddings";
import { parseFile, type ParsedBlock } from "@/lib/parsers";
import { getStorage } from "@/lib/storage";
import { chunkBlocks } from "./chunk";
import { suggestMetadata } from "./suggest";

/**
 * Ingestion pipeline stages (§B6) as plain, idempotent functions. The Inngest
 * function wraps each in a durable step; tests and the seed call them directly.
 */

interface InterviewMeta {
  externalRef?: string;
  segmentName?: string;
  age?: number;
  gender?: string;
  region?: string;
}

function extractInterviewMeta(blocks: ParsedBlock[]): InterviewMeta {
  const meta: InterviewMeta = {};
  for (const block of blocks.slice(0, 6)) {
    const ref = block.text.match(/^Interview\s*:\s*(\S+)/i);
    if (ref) meta.externalRef = ref[1];
    const seg = block.text.match(/^Segment\s*:\s*(.+)$/i);
    if (seg) meta.segmentName = seg[1].trim();
    const demo = block.text.match(/^Demographics\s*:\s*([^,]+),\s*(\d+),\s*(.+)$/i);
    if (demo) {
      meta.gender = demo[1].trim();
      meta.age = Number(demo[2]);
      meta.region = demo[3].trim();
    }
  }
  return meta;
}

/** Stage 1+2 (§B6.1–2): parse, chunk, store chunk rows awaiting review. */
export async function parseAndChunkDocument(documentId: string): Promise<{ chunkCount: number }> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw new Error(`Document ${documentId} not found`);
  if (doc.status === "deleted") return { chunkCount: 0 };

  await db.update(documents).set({ status: "parsing", error: null }).where(eq(documents.id, documentId));

  try {
    const storage = getStorage();
    const buffer = await storage.get({ url: doc.blobUrl, pathname: doc.blobPathname });
    const { blocks, warnings } = await parseFile({
      buffer,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sourceType: doc.sourceType,
    });

    if (blocks.length === 0) {
      await db
        .update(documents)
        .set({ status: "failed", error: "No content could be extracted", parseWarnings: warnings })
        .where(eq(documents.id, documentId));
      return { chunkCount: 0 };
    }

    const drafts = chunkBlocks(blocks, doc.sourceType);

    // transcripts: map to a pseudonymised interview + segment (§B6.3)
    let interviewId: string | null = null;
    let segmentId: string | null = null;
    if (doc.sourceType === "transcript") {
      const meta = extractInterviewMeta(blocks);
      if (meta.segmentName) {
        const [segment] = await db.select().from(segments).where(eq(segments.name, meta.segmentName));
        segmentId = segment?.id ?? null;
      }
      if (meta.externalRef) {
        const [interview] = await db
          .insert(interviews)
          .values({
            waveId: doc.waveId,
            externalRef: meta.externalRef,
            segmentId,
            age: meta.age,
            gender: meta.gender,
            region: meta.region,
          })
          .onConflictDoUpdate({
            target: [interviews.waveId, interviews.externalRef],
            set: { segmentId, age: meta.age, gender: meta.gender, region: meta.region },
          })
          .returning();
        interviewId = interview.id;
      }
    }

    // resolve per-chunk segment names from report attributions (item 3)
    const segmentIdByName = new Map<string, string>();
    if (drafts.some((d) => d.segmentName)) {
      const allSegments = await db.select({ id: segments.id, name: segments.name }).from(segments);
      for (const s of allSegments) segmentIdByName.set(s.name, s.id);
    }

    // idempotent: rerunning the step replaces this document's chunks
    await db.delete(chunks).where(eq(chunks.documentId, documentId));
    if (drafts.length > 0) {
      await db.insert(chunks).values(
        drafts.map((d) => ({
          documentId,
          interviewId,
          seq: d.seq,
          content: d.content,
          tokenCount: d.tokenCount,
          speakerRole: d.speakerRole,
          evidenceType: d.evidenceType,
          sectionPath: d.sectionPath,
          pageRef: d.pageRef,
          region: d.region ?? null,
          // an attributed report quote uses its own segment; otherwise fall back
          // to the document-level (transcript) segment
          segmentId: (d.segmentName ? segmentIdByName.get(d.segmentName) : null) ?? segmentId,
          waveId: doc.waveId,
        })),
      );
    }

    await db
      .update(documents)
      .set({ parseWarnings: warnings.length > 0 ? warnings : null })
      .where(eq(documents.id, documentId));

    return { chunkCount: drafts.length };
  } catch (err) {
    await db
      .update(documents)
      .set({ status: "failed", error: String(err) })
      .where(eq(documents.id, documentId));
    throw err;
  }
}

/** Stage 3 (§B6.3): suggested themes + PII flags, stored not live; then the gate. */
export async function suggestDocumentMetadata(documentId: string): Promise<{ suggested: number }> {
  const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, documentId)).orderBy(chunks.seq);
  if (docChunks.length === 0) {
    await db.update(documents).set({ status: "review" }).where(eq(documents.id, documentId));
    return { suggested: 0 };
  }

  const activeThemes = await db.select().from(themes).where(eq(themes.status, "active"));
  const themeByName = new Map(activeThemes.map((t) => [t.name, t.id]));

  const drafts = docChunks.map((c) => ({
    seq: c.seq,
    content: c.content,
    tokenCount: c.tokenCount,
    speakerRole: c.speakerRole,
    evidenceType: c.evidenceType,
    sectionPath: c.sectionPath,
    pageRef: c.pageRef,
  }));
  const { suggestions, newThemeProposals, usage } = await suggestMetadata(drafts, [...themeByName.keys()]);

  // record genuinely-new theme ideas for admin review (F1). Dedup by name;
  // re-proposals bump the occurrence count so common ideas rise to the top.
  for (const name of newThemeProposals) {
    await db
      .insert(themeProposals)
      .values({ name })
      .onConflictDoUpdate({
        target: themeProposals.name,
        set: { occurrences: sql`${themeProposals.occurrences} + 1` },
      });
  }

  const chunkBySeq = new Map(docChunks.map((c) => [c.seq, c]));
  for (const suggestion of suggestions) {
    const chunk = chunkBySeq.get(suggestion.seq);
    if (!chunk) continue;
    for (const theme of suggestion.themes) {
      const themeId = themeByName.get(theme.name);
      if (!themeId) continue;
      await db
        .insert(chunkThemes)
        .values({ chunkId: chunk.id, themeId, source: "ai_suggested", confidence: theme.confidence })
        .onConflictDoNothing();
    }
    const set: Partial<typeof chunks.$inferInsert> = { sentiment: suggestion.sentiment };
    if (suggestion.pii.length > 0) set.piiSuggestions = suggestion.pii;
    await db.update(chunks).set(set).where(eq(chunks.id, chunk.id));
  }

  // gate (§B6.4): document sits in review until a human approves
  await db
    .update(documents)
    .set({ status: "review", ingestUsage: usage })
    .where(eq(documents.id, documentId));
  return { suggested: suggestions.length };
}

export const EMBED_BATCH_SIZE = 128;

/** Stage 5 (§B6.5): embed one bounded batch; returns count remaining. */
export async function embedDocumentBatch(documentId: string): Promise<{ embedded: number; remaining: number }> {
  const pending = await db
    .select({ id: chunks.id, content: chunks.content })
    .from(chunks)
    .where(sql`${chunks.documentId} = ${documentId} AND ${chunks.embedding} IS NULL`)
    .orderBy(chunks.seq)
    .limit(EMBED_BATCH_SIZE);

  if (pending.length > 0) {
    const provider = getEmbeddings();
    const vectors = await provider.embed(
      pending.map((c) => c.content),
      "document",
    );
    await recordAiUsage({
      kind: "embedding",
      model: provider.model,
      feature: "ingest_embed",
      inputTokens: provider.lastTokens(),
      documentId,
    });
    for (let i = 0; i < pending.length; i++) {
      await db.update(chunks).set({ embedding: vectors[i] }).where(eq(chunks.id, pending[i].id));
    }
  }

  const [{ count: remaining }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chunks)
    .where(sql`${chunks.documentId} = ${documentId} AND ${chunks.embedding} IS NULL`);

  if (remaining === 0) {
    await db.update(documents).set({ status: "indexed" }).where(eq(documents.id, documentId));
  }
  return { embedded: pending.length, remaining };
}

/**
 * Deletion contract (§B5, acceptance-critical): status='deleted', Blob object
 * removed, chunks hard-deleted — text, tsv and embeddings go in one operation.
 */
export async function deleteDocumentData(documentId: string): Promise<void> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return;
  const docChunks = await db.select({ id: chunks.id }).from(chunks).where(eq(chunks.documentId, documentId));
  if (docChunks.length > 0) {
    await db.delete(chunkThemes).where(
      inArray(
        chunkThemes.chunkId,
        docChunks.map((c) => c.id),
      ),
    );
  }
  await db.delete(chunks).where(eq(chunks.documentId, documentId));
  await getStorage().delete({ url: doc.blobUrl, pathname: doc.blobPathname });
  await db
    .update(documents)
    .set({ status: "deleted", blobUrl: "", blobPathname: "" })
    .where(eq(documents.id, documentId));
}
