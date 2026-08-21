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
  // Third-party reference data (published statistics, industry reports) is
  // context, NOT consumer voice from our fieldwork. Counting it would inflate
  // the qualitative base and let a single statistics release read as though
  // consumers had said something (§A6.3 evidence hierarchy).
  const qualitative = chunks.filter((c) => c.sourceType !== "reference_data");
  const referenceCount = chunks.length - qualitative.length;

  const interviews = new Set(qualitative.map((c) => c.interviewRef).filter(Boolean)).size;
  const waves = new Set(qualitative.map((c) => c.waveId)).size;
  const sourceTypes = [...new Set(qualitative.map((c) => c.sourceType))];
  const segments = [...new Set(qualitative.map((c) => c.segmentName).filter((s): s is string => Boolean(s)))];

  let level: EvidentialBasis["level"];
  if (qualitative.length === 0) {
    level = "caution";
  } else if (interviews >= 4 && waves >= 2 && sourceTypes.length >= 2) {
    level = "high";
  } else if (interviews >= 2 || (waves >= 2 && qualitative.length >= 4)) {
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

  // reference data is reported separately so a reader can see it contributed
  // context without it being mistaken for consumer evidence
  const refNote =
    referenceCount > 0
      ? ` Also draws on ${referenceCount} third-party reference passage${referenceCount === 1 ? "" : "s"}, which are context rather than consumer voice.`
      : "";

  const base =
    qualitative.length === 0
      ? referenceCount > 0
        ? "No consumer evidence was retrieved for this question — only third-party reference material, which cannot speak for consumers."
        : "No supporting evidence was retrieved for this question with the current filters."
      : level === "high"
        ? `High confidence: supported by ${parts.join(" across ")}, ${sourceDesc}.`
        : level === "moderate"
          ? `Moderate confidence: based on ${parts.join(" across ")}, ${sourceDesc}.`
          : `Treat with caution: based on ${parts.join(" in ")}, ${sourceDesc}. This is a small base.`;

  const statement = base + refNote;

  return { interviews, waves, sourceTypes, segments, chunkCount: chunks.length, statement, level };
}
