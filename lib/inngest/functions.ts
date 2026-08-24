import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, projects, waves } from "@/db/schema";
import { audit } from "@/lib/audit";
import {
  EMBED_BATCH_SIZE,
  deleteDocumentData,
  embedDocumentBatch,
  parseAndChunkDocument,
  suggestDocumentMetadata,
} from "@/lib/ingestion/pipeline";
import { retagBatch } from "@/lib/services/retag";
import {
  EVENTS,
  inngest,
  type DocumentApprovedData,
  type DocumentUploadedData,
  type RetagRequestedData,
} from "./client";

/**
 * Ingestion pipeline (§B6): every step is a bounded, idempotent, retryable
 * unit — no single invocation handles a whole document (§B4 constraint 2).
 * The pipeline pauses at the review gate; embedding runs on document/approved.
 */
export const ingestDocument = inngest.createFunction(
  { id: "ingest-document", retries: 3, triggers: [{ event: EVENTS.documentUploaded }] },
  async ({ event, step }) => {
    const { documentId } = event.data as unknown as DocumentUploadedData;

    const parsed = await step.run("parse-and-chunk", () => parseAndChunkDocument(documentId));
    if (parsed.chunkCount === 0) {
      return { documentId, status: "failed-or-empty" };
    }

    await step.run("suggest-metadata", () => suggestDocumentMetadata(documentId));
    // [gate] — §B6.4: document now sits in 'review' until a human approves
    return { documentId, status: "review" };
  },
);

export const embedOnApproval = inngest.createFunction(
  { id: "embed-on-approval", retries: 3, triggers: [{ event: EVENTS.documentApproved }] },
  async ({ event, step }) => {
    const { documentId } = event.data as unknown as DocumentApprovedData;
    let batch = 0;
    let remaining = Infinity;
    while (remaining > 0) {
      const result = await step.run(`embed-batch-${batch}`, () => embedDocumentBatch(documentId));
      remaining = result.remaining;
      batch++;
      if (batch > 1000) throw new Error("Embedding runaway: too many batches");
    }
    return { documentId, batches: batch, batchSize: EMBED_BATCH_SIZE };
  },
);

/**
 * Apply one theme to the existing archive, one bounded batch at a time.
 *
 * Durable and resumable by construction: each batch is a step, and progress is
 * recorded on the run row, so an interruption costs at most one batch rather
 * than the whole (paid-for) run.
 */
export const retagTheme = inngest.createFunction(
  { id: "retag-theme", retries: 3, triggers: [{ event: EVENTS.retagRequested }] },
  async ({ event, step }) => {
    const { runId } = event.data as unknown as RetagRequestedData;
    let batch = 0;
    let remaining = Infinity;
    let status = "running";
    while (remaining > 0) {
      const result = await step.run(`retag-batch-${batch}`, () => retagBatch(runId));
      remaining = result.remaining;
      status = result.status;
      batch++;
      if (batch > 1000) throw new Error("Retag runaway: too many batches");
    }
    return { runId, batches: batch, status };
  },
);

/** Nightly retention enforcement (§B5 deletion contract, §A13.1). */
export const enforceRetention = inngest.createFunction(
  { id: "enforce-retention", triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => {
    const expired = await step.run("find-expired", async () => {
      const rows = await db
        .select({ documentId: documents.id, retentionMonths: projects.retentionMonths })
        .from(documents)
        .innerJoin(waves, eq(documents.waveId, waves.id))
        .innerJoin(projects, eq(waves.projectId, projects.id))
        .where(
          and(
            isNotNull(projects.retentionMonths),
            sql`${documents.status} <> 'deleted'`,
            lt(documents.createdAt, sql`now() - make_interval(months => ${projects.retentionMonths})`),
          ),
        );
      return rows.map((r) => r.documentId);
    });

    for (const documentId of expired) {
      await step.run(`delete-${documentId}`, async () => {
        await deleteDocumentData(documentId);
        await audit({
          action: "delete",
          entityType: "document",
          entityId: documentId,
          detail: { reason: "retention_policy" },
        });
      });
    }
    return { deleted: expired.length };
  },
);

export const functions = [ingestDocument, embedOnApproval, retagTheme, enforceRetention];
