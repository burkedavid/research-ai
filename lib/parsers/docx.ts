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

/** Recurring section names our consumer-sentiment reports use (item 1). A match
 *  forces a heading even if the bold-run detection is inconclusive. */
const KNOWN_SECTIONS = [
  "background", "key themes", "overall sentiment", "life in the uk", "personal life",
  "biggest changes", "key concerns", "concerns", "the uk economy", "uk economy", "economy",
  "financial situation", "finances", "confidence in", "action being taken", "changes in behaviour",
  "behaviour", "spending", "financial help", "support", "hot topics", "sentiment towards the future",
  "future", "the research explores", "outlook", "summary", "conclusion", "methodology", "sample",
];

/**
 * Decide whether a paragraph is a section heading. Real reports style headings
 * as fully-bold short paragraphs (not Word Heading styles), so mammoth emits
 * them as <p><strong>…</strong></p>, not <hN>. Treat a paragraph as a heading
 * when its whole text is bold and it reads like a title, or it matches a known
 * recurring section name.
 */
function looksLikeHeading(innerHtml: string, plainText: string): boolean {
  const t = plainText.trim();
  if (!t) return false;

  // every heading candidate must be short and title-like — this keeps long body
  // paragraphs that merely START with a section word (e.g. "Concerns around…")
  // out of the heading set
  const words = t.split(/\s+/).length;
  const isShortTitle = words <= 9 && t.length <= 80 && !/[.!?]$/.test(t);
  if (!isShortTitle) return false;

  const lower = t.toLowerCase();
  const known = KNOWN_SECTIONS.some((s) => lower === s || lower.startsWith(s + " ") || lower.startsWith(s + ":"));
  if (known) return true;

  // fully-bold check: strip bold wrappers; if nothing but whitespace remains,
  // the paragraph was entirely bold
  const withoutBold = innerHtml.replace(/<\/?(strong|b)\b[^>]*>/gi, "");
  const boldText = [...innerHtml.matchAll(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => m[2].replace(/<[^>]+>/g, ""))
    .join("");
  const fullyBold = boldText.trim().length > 0 && decode(withoutBold.replace(/<[^>]+>/g, "")).trim() === "";
  return fullyBold;
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
  let currentSection: string | null = null; // for bold-paragraph headings (flat)
  const tagRe = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  const pathOf = (): string | undefined => {
    const parts = [...trail.filter(Boolean)];
    if (currentSection) parts.push(currentSection);
    return parts.length ? parts.join(" > ") : undefined;
  };

  while ((match = tagRe.exec(result.value)) !== null) {
    const tag = match[1];
    const innerHtml = match[2];
    const text = decode(innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    if (!text) continue;

    if (tag.startsWith("h")) {
      // real Word heading style
      const level = Number(tag[1]) - 1;
      trail.length = level;
      trail[level] = text;
      currentSection = null;
      blocks.push({ text, sectionPath: trail.filter(Boolean).join(" > "), style: "heading" });
    } else if (tag === "p" && looksLikeHeading(innerHtml, text)) {
      // bold-paragraph heading (the real reports' style, item 1)
      currentSection = text;
      blocks.push({ text, sectionPath: pathOf(), style: "heading" });
    } else {
      blocks.push({ text, sectionPath: pathOf(), style: "body" });
    }
  }

  const headingCount = blocks.filter((b) => b.style === "heading").length;
  if (blocks.length === 0) {
    warnings.push({ code: "no_text_extracted", message: "No text could be extracted from the .docx file." });
  } else if (headingCount === 0) {
    warnings.push({
      code: "unreadable_region",
      message: "No section headings were detected — the document was chunked as one section. Check heading styles.",
    });
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
