import type { RetrievedChunk } from "./search";

export interface EvidentialBasis {
  interviews: number;
  waves: number;
  sourceTypes: string[];
  segments: string[];
  chunkCount: number;
  /** narrative statement — numeric confidence scores are prohibited (§B7) */
  statement: string;
  level: "high" | "moderate" | "caution";
}

/**
 * Confidence is narrative and evidence-derived, never a percentage (§B7).
 * Computed from the retrieved set, not asked of the model.
 */
export function computeEvidentialBasis(chunks: RetrievedChunk[]): EvidentialBasis {
  const interviews = new Set(chunks.map((c) => c.interviewRef).filter(Boolean)).size;
  const waves = new Set(chunks.map((c) => c.waveId)).size;
  const sourceTypes = [...new Set(chunks.map((c) => c.sourceType))];
  const segments = [...new Set(chunks.map((c) => c.segmentName).filter((s): s is string => Boolean(s)))];

  let level: EvidentialBasis["level"];
  if (chunks.length === 0) {
    level = "caution";
  } else if (interviews >= 4 && waves >= 2 && sourceTypes.length >= 2) {
    level = "high";
  } else if (interviews >= 2 || (waves >= 2 && chunks.length >= 4)) {
    level = "moderate";
  } else {
    level = "caution";
  }

  const sourceDesc =
    sourceTypes.length >= 2
      ? "across multiple source types"
      : sourceTypes[0]
        ? `from ${sourceTypes[0].replace(/_/g, " ")} evidence only`
        : "with no sources";

  const parts: string[] = [];
  if (interviews > 0) parts.push(`${interviews} interview${interviews === 1 ? "" : "s"}`);
  parts.push(`${waves} wave${waves === 1 ? "" : "s"}`);

  const statement =
    chunks.length === 0
      ? "No supporting evidence was retrieved for this question with the current filters."
      : level === "high"
        ? `High confidence: supported by ${parts.join(" across ")}, ${sourceDesc}.`
        : level === "moderate"
          ? `Moderate confidence: based on ${parts.join(" across ")}, ${sourceDesc}.`
          : `Treat with caution: based on ${parts.join(" in ")}, ${sourceDesc}. This is a small base.`;

  return { interviews, waves, sourceTypes, segments, chunkCount: chunks.length, statement, level };
}
