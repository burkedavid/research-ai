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

  it("detects bold-paragraph section headings, not just Word heading styles (item 1)", async () => {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    // reports style headings as fully-bold paragraphs (no Heading style)
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: "Key Themes", bold: true })] }),
            new Paragraph({ children: [new TextRun("Consumers feel cautious about the cost of living this month.")] }),
            new Paragraph({ children: [new TextRun({ text: "Spending behaviour", bold: true })] }),
            new Paragraph({ children: [new TextRun("Many are trading down on their weekly food shop.")] }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    const { blocks } = await parseDocx(buffer);

    const headings = blocks.filter((b) => b.style === "heading").map((b) => b.text);
    expect(headings).toContain("Key Themes");
    expect(headings).toContain("Spending behaviour");
    // body carries the preceding bold heading as its section path
    const spendBody = blocks.find((b) => b.text.includes("trading down"));
    expect(spendBody?.sectionPath).toContain("Spending behaviour");
  });

  it("does not treat a long body paragraph starting with a section word as a heading (item 1)", async () => {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun(
                  "Concerns around current conflicts remain ever present for consumers, although many feel powerless and try not to dwell on them.",
                ),
              ],
            }),
          ],
        },
      ],
    });
    const { blocks } = await parseDocx(await Packer.toBuffer(doc));
    expect(blocks.every((b) => b.style === "body")).toBe(true);
  });
});

describe("report quote attribution (item 3)", () => {
  it("extracts (Segment, Region) attributed quotes as direct_quote chunks", () => {
    const blocks = [
      { text: "Key concerns right now", style: "heading" as const, sectionPath: "Key concerns right now" },
      { text: "Everyday costs remain the biggest concern for most consumers this month.", style: "body" as const, sectionPath: "Key concerns right now" },
      { text: "It feels like everything is going up at once and my wages just aren't keeping pace.", style: "body" as const, sectionPath: "Key concerns right now" },
      { text: "(Rising Metropolitans, North)", style: "body" as const, sectionPath: "Key concerns right now" },
      { text: "The pension worries me more than anything else at the moment. (Road to Retirement, Scotland)", style: "body" as const, sectionPath: "Key concerns right now" },
    ];
    const chunks = chunkBlocks(blocks, "report");

    const quotes = chunks.filter((c) => c.evidenceType === "direct_quote");
    expect(quotes.length).toBe(2);

    const standalone = quotes.find((q) => q.content.includes("wages just aren't keeping pace"));
    expect(standalone?.segmentName).toBe("Rising Metropolitans");
    expect(standalone?.region).toBe("North");
    expect(standalone?.speakerRole).toBe("consumer");
    expect(standalone?.content).not.toContain("(Rising Metropolitans");

    const inline = quotes.find((q) => q.content.includes("pension worries me"));
    expect(inline?.segmentName).toBe("Road to Retirement");
    expect(inline?.region).toBe("Scotland");
    expect(inline?.content).not.toContain("(Road to Retirement");

    // the non-quote prose stays a researcher_summary chunk
    expect(chunks.some((c) => c.evidenceType === "researcher_summary" && c.content.includes("Everyday costs"))).toBe(true);
  });

  it("strips surrounding quotation marks and captures unattributed verbatim (item 9)", () => {
    const blocks = [
      { text: "Consumer reflections", style: "heading" as const, sectionPath: "Consumer reflections" },
      // curly-quoted, standalone (Segment, Region) attribution on the next line
      { text: "“Everything costs more but my wages have not moved at all this year.”", style: "body" as const, sectionPath: "Consumer reflections" },
      { text: "(Road to Retirement, North)", style: "body" as const, sectionPath: "Consumer reflections" },
      // straight-quoted, wholly a quotation, NO attribution → still captured
      { text: "\"I just try to focus on what I can actually control day to day.\"", style: "body" as const, sectionPath: "Consumer reflections" },
    ];
    const chunks = chunkBlocks(blocks, "report");
    const quotes = chunks.filter((c) => c.evidenceType === "direct_quote");
    expect(quotes.length).toBe(2);

    const attributed = quotes.find((q) => q.content.includes("wages have not moved"));
    expect(attributed?.segmentName).toBe("Road to Retirement");
    expect(attributed?.region).toBe("North");
    // no wrapping quote marks left on the stored content
    expect(attributed?.content.startsWith("“")).toBe(false);
    expect(attributed?.content.startsWith("\"")).toBe(false);
    expect(attributed?.content).toBe("Everything costs more but my wages have not moved at all this year.");

    const orphan = quotes.find((q) => q.content.includes("focus on what I can actually control"));
    expect(orphan).toBeDefined();
    expect(orphan?.segmentName ?? null).toBeNull();
    expect(orphan?.region ?? null).toBeNull();
    expect(orphan?.content.startsWith("\"")).toBe(false);
  });

  it("does not capture a short quoted aside inside prose as a quote (item 9)", () => {
    const blocks = [
      { text: "Consumers often said things were \"fine\" but meant something more complex underneath it all.", style: "body" as const, sectionPath: "S" },
    ];
    const chunks = chunkBlocks(blocks, "report");
    expect(chunks.every((c) => c.evidenceType === "researcher_summary")).toBe(true);
  });

  it("leaves ordinary parentheticals (unknown segment/region) alone", () => {
    const blocks = [
      { text: "Consumers mentioned rising prices (again) across the board this wave.", style: "body" as const, sectionPath: "S" },
    ];
    const chunks = chunkBlocks(blocks, "report");
    expect(chunks.every((c) => c.evidenceType === "researcher_summary")).toBe(true);
    expect(chunks.every((c) => !c.segmentName)).toBe(true);
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
