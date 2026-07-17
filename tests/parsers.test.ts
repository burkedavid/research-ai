import { describe, expect, it } from "vitest";
import { chunkBlocks, estimateTokens } from "@/lib/ingestion/chunk";
import { regexPii } from "@/lib/ingestion/suggest";
import { parseDocx } from "@/lib/parsers/docx";
import { parseTranscriptText } from "@/lib/parsers/transcript";
import { buildReportDocx } from "@/lib/seed/build-files";
import { CORPUS_WAVES, renderTranscript } from "@/lib/seed/corpus";

describe("transcript parser (§B6.1)", () => {
  const interview = CORPUS_WAVES[0].interviews[0];
  const raw = renderTranscript(interview);

  it("tags every spoken block moderator or consumer", () => {
    const { blocks } = parseTranscriptText(raw);
    const spoken = blocks.filter((b) => b.speaker === "moderator" || b.speaker === "consumer");
    expect(spoken.length).toBe(interview.turns.length * 2);
  });

  it("keeps consumer wording verbatim", () => {
    const { blocks } = parseTranscriptText(raw);
    const consumerTexts = blocks.filter((b) => b.speaker === "consumer").map((b) => b.text);
    expect(consumerTexts).toContain(interview.turns[0].consumer);
  });

  it("handles alternative speaker labels and multi-line answers", () => {
    const { blocks } = parseTranscriptText(
      "INT: How are you?\nRESP: Fine thanks.\nStill fine actually.\nQ: Sure?\nA: Yes.",
    );
    expect(blocks.map((b) => b.speaker)).toEqual(["moderator", "consumer", "moderator", "consumer"]);
    expect(blocks[1].text).toBe("Fine thanks. Still fine actually.");
  });

  it("warns when no speaker labels are found", () => {
    const { warnings } = parseTranscriptText("just some plain prose\nwith no labels at all");
    expect(warnings.some((w) => w.code === "ambiguous_speaker")).toBe(true);
  });
});

describe("docx report parser (§B6.1)", () => {
  it("preserves heading hierarchy as section paths", async () => {
    const buffer = await buildReportDocx(CORPUS_WAVES[1]);
    const { blocks, warnings } = await parseDocx(buffer);
    expect(warnings).toEqual([]);
    const bodyBlocks = blocks.filter((b) => b.style === "body");
    expect(bodyBlocks.length).toBeGreaterThan(5);
    const energyBlock = bodyBlocks.find((b) => b.sectionPath?.includes("Energy and fuel"));
    expect(energyBlock).toBeDefined();
    expect(energyBlock?.sectionPath).toContain(CORPUS_WAVES[1].report.title);
  });
});

describe("chunker (§B6.2)", () => {
  it("splits transcripts at Q&A boundaries with the question attached", () => {
    const { blocks } = parseTranscriptText(renderTranscript(CORPUS_WAVES[1].interviews[1]));
    const chunks = chunkBlocks(blocks, "transcript");
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.speakerRole).toBe("mixed");
      expect(chunk.evidenceType).toBe("direct_quote");
      expect(chunk.content).toMatch(/^MODERATOR:/);
      expect(chunk.content).toContain("CONSUMER:");
      // never a dangling question with no answer mid-chunk sequence
      expect(chunk.tokenCount).toBeLessThanOrEqual(800 + 50);
    }
    // planted golden quote survives chunking verbatim
    const all = chunks.map((c) => c.content).join("\n");
    expect(all).toContain("We have started keeping the heating off until the grandchildren visit.");
  });

  it("chunks reports at heading boundaries as researcher_summary", async () => {
    const buffer = await buildReportDocx(CORPUS_WAVES[0]);
    const { blocks } = await parseDocx(buffer);
    const chunks = chunkBlocks(blocks, "report");
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.evidenceType).toBe("researcher_summary");
      expect(chunk.speakerRole).toBe("n/a");
      expect(chunk.sectionPath).toBeTruthy();
    }
  });

  it("estimates tokens roughly per word", () => {
    expect(estimateTokens("one two three four")).toBe(6);
  });
});

describe("PII regexes (§B6.3)", () => {
  it("flags emails, phones, postcodes and self-introduced names", () => {
    const spans = regexPii(
      "Contact me on my name is Sarah Jones, email sarah@example.com, phone 07700 900123, SW1A 1AA.",
    );
    const kinds = spans.map((s) => s.kind).sort();
    expect(kinds).toContain("email");
    expect(kinds).toContain("phone");
    expect(kinds).toContain("address");
    expect(spans.find((s) => s.kind === "name")?.text).toBe("Sarah Jones");
  });

  it("does not flag pseudonymised interview refs", () => {
    expect(regexPii("Interview RM_F_07_2026 discussed banking.")).toEqual([]);
  });
});
