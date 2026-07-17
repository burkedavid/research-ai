import { XMLParser } from "fast-xml-parser";
import unzipper from "unzipper";
import type { ParsedBlock, ParseResult, ParseWarning } from "./types";

/**
 * PowerPoint text extraction (§B6.1): unzip, read ppt/slides/slideN.xml,
 * collect a:t text runs per slide. Pure JS, serverless-compatible.
 */
export async function parsePptx(buffer: Buffer): Promise<ParseResult> {
  const warnings: ParseWarning[] = [];
  const blocks: ParsedBlock[] = [];
  const parser = new XMLParser({ ignoreAttributes: false });

  const directory = await unzipper.Open.buffer(buffer);
  const slideFiles = directory.files
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path))
    .sort((a, b) => {
      const n = (p: string) => Number(p.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return n(a.path) - n(b.path);
    });

  if (slideFiles.length === 0) {
    warnings.push({ code: "no_text_extracted", message: "No slides found in the .pptx file." });
    return { blocks, warnings };
  }

  const collectTexts = (node: unknown, out: string[]): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) collectTexts(item, out);
      return;
    }
    if (typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === "a:t") {
          if (typeof value === "string" || typeof value === "number") out.push(String(value));
          else if (Array.isArray(value)) out.push(...value.map(String));
        } else if (key !== "@_") {
          collectTexts(value, out);
        }
      }
    }
  };

  for (const file of slideFiles) {
    const slideNum = Number(file.path.match(/slide(\d+)\.xml/)?.[1]);
    try {
      const xml = (await file.buffer()).toString("utf-8");
      const tree = parser.parse(xml);
      const texts: string[] = [];
      collectTexts(tree, texts);
      const combined = texts.join("\n").trim();
      if (combined) {
        const [first, ...rest] = combined.split("\n");
        blocks.push({ text: first, pageRef: `Slide ${slideNum}`, sectionPath: first, style: "heading" });
        const body = rest.join(" ").trim();
        if (body) {
          blocks.push({ text: body, pageRef: `Slide ${slideNum}`, sectionPath: first, style: "body" });
        }
      }
    } catch (err) {
      warnings.push({
        code: "unreadable_region",
        message: `Slide ${slideNum} could not be parsed: ${String(err)}`,
        location: `Slide ${slideNum}`,
      });
    }
  }

  if (blocks.length === 0) {
    warnings.push({ code: "no_text_extracted", message: "Slides contained no extractable text." });
  }
  return { blocks, warnings };
}
