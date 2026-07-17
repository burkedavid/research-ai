import type { ParsedBlock, ParseResult, ParseWarning } from "./types";

/**
 * PDF text extraction (§B6.1) with per-page references. Scanned/image-only
 * pages produce a possible_scanned_pdf warning for the review queue.
 *
 * pdf-parse pulls in pdfjs, which references browser globals (DOMMatrix) at
 * module load. We import it lazily INSIDE this function so it only loads when a
 * PDF is actually parsed — importing it at module top level would crash every
 * serverless route that transitively imports the parser barrel.
 */
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const warnings: ParseWarning[] = [];
  const blocks: ParsedBlock[] = [];

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();

    for (const page of result.pages) {
      const paragraphs = page.text
        .split(/\n{2,}|(?<=\.)\n(?=[A-Z])/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 0);
      for (const p of paragraphs) {
        blocks.push({ text: p, pageRef: `p. ${page.num}`, style: "body" });
      }
      if (!page.text.trim()) {
        warnings.push({
          code: "possible_scanned_pdf",
          message: `Page ${page.num} contains no extractable text — it may be scanned and need OCR.`,
          location: `p. ${page.num}`,
        });
      }
    }
  } finally {
    await parser.destroy();
  }

  if (blocks.length === 0) {
    warnings.push({
      code: "possible_scanned_pdf",
      message: "No text extracted from any page — the PDF may be scanned images.",
    });
  }
  return { blocks, warnings };
}
