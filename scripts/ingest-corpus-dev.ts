import "./load-env";

/** Ingests the synthetic corpus into the DEV database so the dev server has
 *  real content (screenshots, demos). Idempotent. */
async function main() {
  const { ensureCorpusIngested } = await import("../tests/helpers");
  await ensureCorpusIngested();
  console.log("DEV_CORPUS_INGESTED");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
