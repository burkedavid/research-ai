import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, chunkThemes, chunks, segments, themes, waves } from "@/db/schema";
import { buildExportDocx } from "@/lib/export/docx";
import { parseDocx } from "@/lib/parsers/docx";
import { comparePeriods } from "@/lib/services/compare";
import { generateReport } from "@/lib/services/reports";
import { getSegmentProfile } from "@/lib/services/segments";
import { createTheme, mergeThemes } from "@/lib/services/themes";
import { admin, ensureCorpusIngested, researcher, summaryOnly } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

async function waveIdFor(year: number): Promise<string> {
  const [wave] = await db.select().from(waves).where(eq(waves.year, year));
  return wave.id;
}

describe("comparison mode (§B7, acceptance criterion 5)", () => {
  it("compares two waves with labelled evidence sets and evidential bases", async () => {
    const user = await researcher();
    const result = await comparePeriods({
      user,
      question: "What has changed in how consumers talk about energy?",
      labelA: "March 2020",
      filtersA: { waveIds: [await waveIdFor(2020)] },
      labelB: "October 2022",
      filtersB: { waveIds: [await waveIdFor(2022)] },
    });

    expect(result.text.length).toBeGreaterThan(50);
    expect(result.sideA.citations.length).toBeGreaterThan(0);
    expect(result.sideB.citations.length).toBeGreaterThan(0);
    // evidence isolation: side A only 2020, side B only 2022
    expect(result.sideA.citations.every((c) => c.wave.startsWith("2020"))).toBe(true);
    expect(result.sideB.citations.every((c) => c.wave.startsWith("2022"))).toBe(true);
    expect(result.sideA.basis.statement).toBeTruthy();
    expect(result.provenance.model).toBeTruthy();
    expect(result.provenance.usage.input_tokens).toBeGreaterThanOrEqual(0);
  });
});

describe("report generation and export (§B8, acceptance criterion 6)", () => {
  it("monthly summary drafts cited sections for every topic", async () => {
    const user = await researcher();
    const draft = await generateReport({ user, template: "monthly_summary", waveId: await waveIdFor(2022) });
    expect(draft.title).toContain("October 2022");
    expect(draft.sections.length).toBe(6);
    const withEvidence = draft.sections.filter((s) => s.citations.length > 0);
    expect(withEvidence.length).toBeGreaterThanOrEqual(4);
    for (const section of withEvidence) {
      expect(section.text).toMatch(/\[\d+\]/); // cited
      expect(section.basis?.statement).toBeTruthy();
    }
    expect(draft.provenance.promptVersion).toBeTruthy();
    expect(draft.provenance.retrievalVersion).toBeTruthy();
  });

  it("what-changed compares against previous wave with the four framings available", async () => {
    const user = await researcher();
    const draft = await generateReport({ user, template: "what_changed", waveId: await waveIdFor(2026) });
    expect(draft.sections.length).toBeGreaterThanOrEqual(1);
    expect(draft.sections[0].heading).toMatch(/previous wave/i);
    expect(draft.sections[0].citations.length).toBeGreaterThan(0);
  });

  it("docx export round-trips: headings, body and citations appendix survive", async () => {
    const buffer = await buildExportDocx({
      title: "Test export",
      sections: [
        {
          heading: "Findings",
          text: "Several consumers appeared cautious [1].",
          citations: [
            {
              n: 1,
              chunkId: "c1",
              documentId: "d1",
              filename: "transcript-BE.txt",
              sourceType: "transcript",
              evidenceType: "direct_quote",
              wave: "2022-10",
              segmentName: "Budgeting Elderly",
              interviewRef: "BE_M_10_2022",
              sectionPath: null,
              pageRef: null,
            },
          ],
        },
      ],
    });
    const { blocks } = await parseDocx(buffer);
    const text = blocks.map((b) => b.text).join("\n");
    expect(text).toContain("Test export");
    expect(text).toContain("Several consumers appeared cautious");
    expect(text).toContain("Sources and citations");
    expect(text).toContain("transcript-BE.txt");
    expect(text).toContain("BE_M_10_2022"); // source references retained (criterion 6)
  });
});

describe("segment observatory (§B8)", () => {
  it("profiles a segment with theme frequencies, timeline and verbatim", async () => {
    const user = await researcher();
    const [segment] = await db.select().from(segments).where(eq(segments.name, "Stretched Families"));
    const profile = await getSegmentProfile(user, segment.id);
    expect(profile).not.toBeNull();
    expect(profile!.themeFrequencies.length).toBeGreaterThan(0);
    expect(profile!.timeline.length).toBeGreaterThan(0);
    expect(profile!.verbatim.length).toBeGreaterThan(0);
    expect(profile!.words.length).toBeGreaterThan(0);
    // frequencies carry interview counts so the UI can flag small bases
    expect(profile!.themeFrequencies[0].interviewCount).toBeGreaterThanOrEqual(0);
  });

  it("hides verbatim from users without transcript access", async () => {
    const user = await summaryOnly();
    const [segment] = await db.select().from(segments).where(eq(segments.name, "Stretched Families"));
    const profile = await getSegmentProfile(user, segment.id);
    expect(profile!.verbatim).toEqual([]);
  });
});

describe("theme taxonomy (§A5.2)", () => {
  it("merge is traceable, not destructive, and moves tags", async () => {
    const adminUser = await admin();
    const source = await createTheme(adminUser, { name: "Utility bills (test)", definition: "test dup" });
    const [target] = await db.select().from(themes).where(eq(themes.name, "Energy and fuel"));

    // tag one chunk with the source theme so the merge has something to move
    const [chunk] = await db.select().from(chunks).limit(1);
    await db.insert(chunkThemes).values({ chunkId: chunk.id, themeId: source.id, source: "human" });

    await mergeThemes(adminUser, source.id, target.id);

    const [merged] = await db.select().from(themes).where(eq(themes.id, source.id));
    expect(merged.status).toBe("merged"); // row survives — traceable
    expect(merged.mergedInto).toBe(target.id);
    const orphanTags = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, source.id));
    expect(orphanTags).toEqual([]);
    const movedTag = await db
      .select()
      .from(chunkThemes)
      .where(eq(chunkThemes.themeId, target.id));
    expect(movedTag.some((t) => t.chunkId === chunk.id)).toBe(true);

    const audits = await db.select().from(auditLog).where(eq(auditLog.action, "theme_edit"));
    expect(audits.some((a) => (a.detail as { op?: string })?.op === "merge")).toBe(true);
  });

  it("non-admins cannot edit the taxonomy", async () => {
    const user = await researcher();
    await expect(createTheme(user, { name: "Should fail" })).rejects.toThrow(/admin/i);
  });
});
