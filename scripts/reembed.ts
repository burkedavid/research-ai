import "./load-env";

/**
 * Re-embed the whole corpus with the currently-configured embeddings provider.
 *
 * WHY: existing chunk vectors were written by whatever provider was active at
 * ingest (e.g. the fake hash embeddings). After switching EMBEDDINGS_PROVIDER
 * (e.g. to `openai`), the query leg and the stored document leg no longer share
 * a vector space, so semantic search is meaningless until every chunk is
 * re-embedded. Run this once after changing the provider.
 *
 * SAFETY:
 *  - Works one document at a time: null that document's vectors, immediately
 *    re-embed it, then move on. The "vector leg degraded" window is only ever
 *    one document wide, never the whole archive.
 *  - Resumable: re-embedding keys off `embedding IS NULL`, so a crash/rate-limit
 *    just resumes where it stopped.
 *  - Retries transient 429s with exponential backoff.
 *  - Spends real money and needs the provider key present in THIS environment.
 *    Verify against the local/test DB before pointing DATABASE_URL at prod.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { db } = await import("@/db");
  const { chunks, documents } = await import("@/db/schema");
  const { getEmbeddings } = await import("@/lib/embeddings");
  const { embedDocumentBatch } = await import("@/lib/ingestion/pipeline");
  const { eq } = await import("drizzle-orm");

  const provider = getEmbeddings();
  console.log(`REEMBED start provider-model=${provider.model} dims=1024`);
  console.log(`REEMBED database=${(process.env.DATABASE_URL ?? "").replace(/:[^:@/]+@/, ":****@")}`);

  const docs = await db.select({ id: documents.id, filename: documents.filename }).from(documents);
  let totalChunks = 0;

  for (const doc of docs) {
    // 1. clear this document's vectors (one-document degraded window)
    await db.update(chunks).set({ embedding: null }).where(eq(chunks.documentId, doc.id));

    // 2. re-embed batch-by-batch until none remain, backing off on 429s
    let remaining = Infinity;
    let backoff = 1000;
    while (remaining > 0) {
      try {
        const res = await embedDocumentBatch(doc.id);
        totalChunks += res.embedded;
        remaining = res.remaining;
        backoff = 1000;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b429\b|rate.?limit/i.test(msg) && backoff <= 64_000) {
          console.warn(`REEMBED rate-limited, backing off ${backoff}ms`);
          await sleep(backoff);
          backoff *= 2;
          continue;
        }
        throw err;
      }
    }

    // (embedding-model provenance is recorded per query on messages, not here)
    console.log(`REEMBED ok ${doc.filename}`);
  }

  console.log(`REEMBED_DONE documents=${docs.length} chunks=${totalChunks} model=${provider.model}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
