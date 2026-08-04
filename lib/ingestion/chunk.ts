import { CHUNKING } from "@/lib/config";
import type { ParsedBlock } from "@/lib/parsers";
import type { SourceType } from "@/lib/parsers";
import { matchRegion, matchSegmentName } from "@/lib/seed/segments";

export type SpeakerRole = "moderator" | "consumer" | "mixed" | "n/a";
export type EvidenceType = "direct_quote" | "researcher_summary" | "guide" | "context";

export interface ChunkDraft {
  seq: number;
  content: string;
  tokenCount: number;
  speakerRole: SpeakerRole;
  evidenceType: EvidenceType;
  sectionPath: string | null;
  pageRef: string | null;
  /** report-quote attribution (item 3): resolved segment name + region */
  segmentName?: string | null;
  region?: string | null;
}

/**
 * Detect an inline attribution "(Segment, Region)" in report prose (item 3),
 * either at the end of the quote paragraph or as a standalone line. Returns the
 * resolved segment + region, and — when inline — the quote with the marker
 * stripped. Only matches when BOTH the segment and region are recognised, so
 * ordinary parenthetical asides are left alone.
 */
const ATTR_RE = /\(([^(),]{3,40}),\s*([A-Za-z][A-Za-z .&'-]{1,20})\)\s*$/;

export function parseAttribution(text: string): { quote: string; segment: string; region: string } | null {
  const m = text.match(ATTR_RE);
  if (!m) return null;
  const segment = matchSegmentName(m[1]);
  const region = matchRegion(m[2]);
  if (!segment || !region) return null;
  return { quote: text.slice(0, m.index).trim(), segment, region };
}

/** A standalone "(Segment, Region)" line that attributes the previous paragraph. */
export function parseStandaloneAttribution(text: string): { segment: string; region: string } | null {
  if (!/^\(.*\)$/.test(text.trim())) return null;
  const parsed = parseAttribution(text);
  if (!parsed || parsed.quote !== "") return null;
  return { segment: parsed.segment, region: parsed.region };
}

/** Rough token estimate: ~1.33 tokens per word. */
export function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.33);
}

const EVIDENCE_BY_SOURCE: Record<SourceType, EvidenceType> = {
  report: "researcher_summary",
  transcript: "direct_quote",
  crib_sheet: "context",
  moderator_notes: "context",
  discussion_guide: "guide",
  debrief_deck: "researcher_summary",
  coding_frame: "context",
  tabular: "context",
  other: "context",
};

/**
 * Transcript chunking (§B6.2): split at Q&A turn boundaries, never mid-answer.
 * The moderator question stays attached to the consumer answer for context
 * (speaker_role='mixed'); evidence_type follows the consumer content.
 * Consecutive Q&A pairs merge until the chunk reaches the minimum size.
 */
function chunkTranscript(blocks: ParsedBlock[]): ChunkDraft[] {
  interface Pair {
    text: string;
    hasModerator: boolean;
    hasConsumer: boolean;
    pageRef?: string;
  }

  const pairs: Pair[] = [];
  let curLines: string[] = [];
  let curHasModerator = false;
  let curHasConsumer = false;
  let curPageRef: string | undefined;

  const flushPair = () => {
    if (curLines.length > 0) {
      pairs.push({
        text: curLines.join("\n\n"),
        hasModerator: curHasModerator,
        hasConsumer: curHasConsumer,
        pageRef: curPageRef,
      });
    }
    curLines = [];
    curHasModerator = false;
    curHasConsumer = false;
    curPageRef = undefined;
  };

  for (const block of blocks) {
    if (block.speaker === "moderator") {
      // a new question closes the previous Q&A pair
      if (curHasConsumer) flushPair();
      curLines.push(`MODERATOR: ${block.text}`);
      curHasModerator = true;
      curPageRef ??= block.pageRef;
    } else if (block.speaker === "consumer") {
      curLines.push(`CONSUMER: ${block.text}`);
      curHasConsumer = true;
      curPageRef ??= block.pageRef;
    }
    // 'unknown' header/metadata blocks are intentionally not indexed as evidence
  }
  flushPair();

  const chunks: ChunkDraft[] = [];
  let buffer: Pair[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.map((p) => p.text).join("\n\n");
    const hasModerator = buffer.some((p) => p.hasModerator);
    const hasConsumer = buffer.some((p) => p.hasConsumer);
    chunks.push({
      seq: chunks.length,
      content,
      tokenCount: estimateTokens(content),
      speakerRole: hasModerator && hasConsumer ? "mixed" : hasConsumer ? "consumer" : "moderator",
      evidenceType: hasConsumer ? "direct_quote" : "guide",
      sectionPath: null,
      pageRef: buffer[0].pageRef ?? null,
    });
    buffer = [];
  };

  for (const pair of pairs) {
    const bufferedTokens = estimateTokens(buffer.map((p) => p.text).join("\n\n"));
    const pairTokens = estimateTokens(pair.text);
    if (buffer.length > 0 && bufferedTokens + pairTokens > CHUNKING.maxTokens) flush();
    buffer.push(pair);
    if (estimateTokens(buffer.map((p) => p.text).join("\n\n")) >= CHUNKING.minTokens) flush();
  }
  flush();

  return chunks;
}

/**
 * Document chunking (§B6.2): sections split at heading boundaries; paragraphs
 * within a section merge up to the max. Never fixed-window mid-sentence splits.
 */
function chunkDocument(blocks: ParsedBlock[], evidenceType: EvidenceType): ChunkDraft[] {
  const chunks: ChunkDraft[] = [];
  let section: string | null = null;
  let pageRef: string | null = null;
  let parts: string[] = [];

  const flush = () => {
    const content = parts.join("\n\n").trim();
    parts = [];
    if (!content) return;
    chunks.push({
      seq: chunks.length,
      content,
      tokenCount: estimateTokens(content),
      speakerRole: "n/a",
      evidenceType,
      sectionPath: section,
      pageRef,
    });
  };

  // attributed report quotes become their own direct_quote chunks (item 3)
  const emitQuote = (quote: string, segment: string, region: string) => {
    if (!quote.trim()) return;
    chunks.push({
      seq: chunks.length,
      content: quote.trim(),
      tokenCount: estimateTokens(quote),
      speakerRole: "consumer",
      evidenceType: "direct_quote",
      sectionPath: section,
      pageRef,
      segmentName: segment,
      region,
    });
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.style === "heading") {
      flush();
      section = block.sectionPath ?? block.text;
      pageRef = block.pageRef ?? null;
      continue;
    }
    const blockSection: string | null = block.sectionPath ?? section;
    if (blockSection !== section) {
      flush();
      section = blockSection;
    }
    if (block.pageRef) pageRef = block.pageRef;

    // inline attribution: "quote text (Segment, Region)"
    const inline = parseAttribution(block.text);
    if (inline) {
      flush();
      emitQuote(inline.quote, inline.segment, inline.region);
      continue;
    }
    // standalone attribution on the next line: previous paragraph is the quote
    const next = blocks[i + 1];
    const standalone = next && next.style !== "heading" ? parseStandaloneAttribution(next.text) : null;
    if (standalone) {
      flush();
      emitQuote(block.text, standalone.segment, standalone.region);
      i++; // consume the attribution line
      continue;
    }

    if (estimateTokens([...parts, block.text].join("\n\n")) > CHUNKING.maxTokens && parts.length > 0) {
      flush();
    }
    parts.push(block.text);
  }
  flush();

  // fold undersized trailing chunks into their section neighbour — but never
  // merge an attributed quote (different evidence type, carries segment/region)
  const merged: ChunkDraft[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      chunk.evidenceType === prev.evidenceType &&
      !chunk.segmentName &&
      !prev.segmentName &&
      chunk.tokenCount < CHUNKING.minTokens &&
      prev.sectionPath === chunk.sectionPath &&
      prev.tokenCount + chunk.tokenCount <= CHUNKING.maxTokens
    ) {
      prev.content = `${prev.content}\n\n${chunk.content}`;
      prev.tokenCount = estimateTokens(prev.content);
    } else {
      merged.push(chunk);
    }
  }
  return merged.map((c, i) => ({ ...c, seq: i }));
}

export function chunkBlocks(blocks: ParsedBlock[], sourceType: SourceType): ChunkDraft[] {
  if (sourceType === "transcript") return chunkTranscript(blocks);
  return chunkDocument(blocks, EVIDENCE_BY_SOURCE[sourceType]);
}
