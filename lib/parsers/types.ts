export type Speaker = "moderator" | "consumer" | "unknown";

/** One extracted block of source text with positional context (§B6.1). */
export interface ParsedBlock {
  text: string;
  /** e.g. "Report > Cost of living > Outlook" */
  sectionPath?: string;
  /** e.g. "p. 4" or "Slide 3" */
  pageRef?: string;
  speaker?: Speaker;
  style?: "heading" | "body";
}

export interface ParseWarning {
  code:
    | "unreadable_region"
    | "ambiguous_speaker"
    | "no_text_extracted"
    | "possible_scanned_pdf"
    | "unsupported_content";
  message: string;
  location?: string;
}

export interface ParseResult {
  blocks: ParsedBlock[];
  warnings: ParseWarning[];
}
