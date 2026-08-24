import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import {
  embedDocumentBatch,
  parseAndChunkDocument,
  suggestDocumentMetadata,
} from "./pipeline";

/**
 * Pipeline dispatch: production sends Inngest events (§B6); dev and tests run
 * the same stage functions inline so no Inngest dev server is required.
 */
export async function dispatchDocumentUploaded(documentId: string): Promise<void> {
  if (env.PIPELINE_MODE === "inngest") {
    await inngest.send({ name: "document/uploaded", data: { documentId } });
    return;
  }
  const { chunkCount } = await parseAndChunkDocument(documentId);
  if (chunkCount > 0) await suggestDocumentMetadata(documentId);
}

export async function dispatchDocumentApproved(documentId: string, userId: string): Promise<void> {
  if (env.PIPELINE_MODE === "inngest") {
    await inngest.send({ name: "document/approved", data: { documentId, userId } });
    return;
  }
  let remaining = Infinity;
  let iterations = 0;
  while (remaining > 0 && iterations < 1000) {
    ({ remaining } = await embedDocumentBatch(documentId));
    iterations++;
  }
}

/**
 * Drive a theme-tagging run to completion. Inngest in production so the work
 * is durable and retried; inline in dev/tests, same functions either way.
 */
export async function dispatchRetagRun(runId: string): Promise<void> {
  if (env.PIPELINE_MODE === "inngest") {
    await inngest.send({ name: "theme/retag.requested", data: { runId } });
    return;
  }
  const { retagBatch } = await import("@/lib/services/retag");
  let remaining = Infinity;
  let iterations = 0;
  while (remaining > 0 && iterations < 1000) {
    ({ remaining } = await retagBatch(runId));
    iterations++;
  }
}
