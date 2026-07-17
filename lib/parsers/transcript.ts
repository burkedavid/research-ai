import type { ParsedBlock, ParseResult, ParseWarning, Speaker } from "./types";

/**
 * Transcript parser (§B6.1): detects speaker labels via configurable regexes
 * and tags every block moderator or consumer. Handles plain text and VTT.
 */
const MODERATOR_PATTERNS = [/^(MOD(ERATOR)?|INT(ERVIEWER)?|I|Q)\s*[:.\-]\s*/i];
const CONSUMER_PATTERNS = [/^(R(ESP(ONDENT)?)?|A|C(ONSUMER)?|P(ARTICIPANT)?)\s*[:.\-]\s*/i];
// e.g. "Sarah:" — a named speaker is a consumer unless matched above
const NAMED_PATTERN = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*:\s*/;

function classifyLine(line: string): { speaker: Speaker | null; text: string } {
  for (const p of MODERATOR_PATTERNS) {
    if (p.test(line)) return { speaker: "moderator", text: line.replace(p, "").trim() };
  }
  for (const p of CONSUMER_PATTERNS) {
    if (p.test(line)) return { speaker: "consumer", text: line.replace(p, "").trim() };
  }
  const named = line.match(NAMED_PATTERN);
  if (named) return { speaker: "consumer", text: line.replace(NAMED_PATTERN, "").trim() };
  return { speaker: null, text: line.trim() };
}

function stripVtt(raw: string): string {
  if (!raw.trimStart().startsWith("WEBVTT")) return raw;
  return raw
    .split(/\r?\n/)
    .filter((l) => !/^WEBVTT/.test(l) && !/^\d+$/.test(l.trim()) && !/-->/.test(l))
    .join("\n");
}

export function parseTranscriptText(raw: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const text = stripVtt(raw);
  const lines = text.split(/\r?\n/);

  const blocks: ParsedBlock[] = [];
  let current: { speaker: Speaker; text: string[] } | null = null;
  let unlabelled = 0;

  const flush = () => {
    if (current && current.text.join(" ").trim()) {
      blocks.push({ text: current.text.join(" ").trim(), speaker: current.speaker, style: "body" });
    }
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    // header metadata lines (Interview:, Segment:, Demographics:) pass through
    // untagged — but only before the first spoken turn starts
    if (/^(Interview|Segment|Demographics|Date|Location)\s*:/i.test(line) && !current) {
      blocks.push({ text: line.trim(), speaker: "unknown", style: "body" });
      continue;
    }
    const { speaker, text: content } = classifyLine(line);
    if (speaker) {
      flush();
      current = { speaker, text: [content] };
    } else if (current) {
      current.text.push(content); // continuation of the current turn
    } else {
      unlabelled++;
      blocks.push({ text: content, speaker: "unknown", style: "body" });
    }
  }
  flush();

  const spoken = blocks.filter((b) => b.speaker !== "unknown");
  if (spoken.length === 0) {
    warnings.push({
      code: "ambiguous_speaker",
      message: "No speaker labels detected — every block is untagged. Check the transcript format.",
    });
  } else if (unlabelled > 0) {
    warnings.push({
      code: "ambiguous_speaker",
      message: `${unlabelled} line(s) had no speaker label and no preceding turn to attach to.`,
    });
  }
  if (blocks.length === 0) {
    warnings.push({ code: "no_text_extracted", message: "Transcript contained no text." });
  }

  return { blocks, warnings };
}
