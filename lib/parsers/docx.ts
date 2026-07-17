import mammoth from "mammoth";
import type { ParsedBlock, ParseResult, ParseWarning } from "./types";
import { parseTranscriptText } from "./transcript";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decode(html: string): string {
  return html.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m).trim();
}

/**
 * Report/document docx parser (§B6.1): preserves heading hierarchy so each
 * body block carries its full section path ("Report > Cost of living > ...").
 */
export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const warnings: ParseWarning[] = [];
  const result = await mammoth.convertToHtml({ buffer });
  for (const m of result.messages) {
    if (m.type === "warning") {
      warnings.push({ code: "unreadable_region", message: m.message });
    }
  }

  const blocks: ParsedBlock[] = [];
  const trail: string[] = []; // heading text by level, index 0 = h1
  const tagRe = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(result.value)) !== null) {
    const tag = match[1];
    const text = decode(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    if (!text) continue;

    if (tag.startsWith("h")) {
      const level = Number(tag[1]) - 1;
      trail.length = level;
      trail[level] = text;
      blocks.push({ text, sectionPath: trail.filter(Boolean).join(" > "), style: "heading" });
    } else {
      blocks.push({ text, sectionPath: trail.filter(Boolean).join(" > ") || undefined, style: "body" });
    }
  }

  if (blocks.length === 0) {
    warnings.push({ code: "no_text_extracted", message: "No text could be extracted from the .docx file." });
  }
  return { blocks, warnings };
}

/** Transcripts supplied as .docx: extract raw text, then run the transcript parser. */
export async function parseDocxTranscript(buffer: Buffer): Promise<ParseResult> {
  const raw = await mammoth.extractRawText({ buffer });
  const result = parseTranscriptText(raw.value);
  for (const m of raw.messages) {
    if (m.type === "warning") {
      result.warnings.push({ code: "unreadable_region", message: m.message });
    }
  }
  return result;
}
