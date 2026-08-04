import "./load-env";
import { readFile } from "node:fs/promises";

/** One-off: dump how the parser + chunker see a real report, to design quote capture. */
async function main() {
  const { parseDocx } = await import("@/lib/parsers/docx");
  const { chunkBlocks } = await import("@/lib/ingestion/chunk");

  const path = process.argv[2] ?? "Consumer Sentiment - Summary ReportF 01.07.26 GPT.docx";
  const buf = await readFile(path);
  const { blocks, warnings } = await parseDocx(buf);

  console.log(`WARNINGS ${JSON.stringify(warnings)}`);
  console.log(`BLOCKS ${blocks.length}`);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = b.text.length > 160 ? b.text.slice(0, 160) + "…" : b.text;
    console.log(`[${i}] ${b.style.toUpperCase()} | path=${b.sectionPath ?? ""} | ${t}`);
  }

  const chunks = chunkBlocks(blocks, "report");
  const quotes = chunks.filter((c) => c.evidenceType === "direct_quote");
  console.log(`\nCHUNKS ${chunks.length} | DIRECT_QUOTES ${quotes.length}`);
  for (const q of quotes) {
    console.log(`  QUOTE seg=${q.segmentName ?? "-"} region=${q.region ?? "-"} :: ${q.content.slice(0, 120)}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
