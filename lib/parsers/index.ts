import { parseDocx, parseDocxTranscript } from "./docx";
import { parsePdf } from "./pdf";
import { parsePptx } from "./pptx";
import { parseTabular } from "./tabular";
import { parseTranscriptText } from "./transcript";
import type { ParseResult } from "./types";

export type { ParsedBlock, ParseResult, ParseWarning, Speaker } from "./types";

export type SourceType =
  | "report"
  | "transcript"
  | "crib_sheet"
  | "moderator_notes"
  | "discussion_guide"
  | "debrief_deck"
  | "coding_frame"
  | "tabular"
  | "other";

/**
 * Route a file to the right parser by source type + mime/filename (§B6.1).
 * Source type decides interpretation: a .docx transcript goes through the
 * speaker-detecting transcript parser, not the report parser.
 */
export async function parseFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sourceType: SourceType;
}): Promise<ParseResult> {
  const { buffer, filename, mimeType, sourceType } = params;
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (sourceType === "transcript") {
    if (ext === "docx") return parseDocxTranscript(buffer);
    return parseTranscriptText(buffer.toString("utf-8"));
  }

  if (ext === "docx" || mimeType.includes("wordprocessingml")) return parseDocx(buffer);
  if (ext === "pptx" || mimeType.includes("presentationml")) return parsePptx(buffer);
  if (ext === "xlsx" || ext === "xls" || ext === "csv" || mimeType.includes("spreadsheetml") || mimeType === "text/csv") {
    return parseTabular(buffer, filename);
  }
  if (ext === "pdf" || mimeType === "application/pdf") return parsePdf(buffer);
  if (ext === "vtt" || ext === "txt" || mimeType.startsWith("text/")) {
    // plain text that is not a transcript: paragraphs as body blocks
    const paragraphs = buffer
      .toString("utf-8")
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return {
      blocks: paragraphs.map((text) => ({ text, style: "body" as const })),
      warnings: paragraphs.length ? [] : [{ code: "no_text_extracted", message: "File contained no text." }],
    };
  }

  return {
    blocks: [],
    warnings: [
      {
        code: "unsupported_content",
        message: `Unsupported file type: ${filename} (${mimeType}). Supported: docx, pptx, xlsx, csv, pdf, txt, vtt.`,
      },
    ],
  };
}
