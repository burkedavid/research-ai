import { CHUNKING } from "@/lib/config";
import type { ParsedBlock } from "@/lib/parsers";
import type { SourceType } from "@/lib/parsers";

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

  for (const block of blocks) {
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
    if (estimateTokens([...parts, block.text].join("\n\n")) > CHUNKING.maxTokens && parts.length > 0) {
      flush();
    }
    parts.push(block.text);
  }
  flush();

  // fold undersized trailing chunks into their section neighbour
  const merged: ChunkDraft[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
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
