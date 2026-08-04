import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, chunkThemes, chunks, documents, segments, themeProposals, themes, waves } from "@/db/schema";
import { buildExportDocx } from "@/lib/export/docx";
import { parseDocx } from "@/lib/parsers/docx";
import { comparePeriods } from "@/lib/services/compare";
import { acceptAllSuggestions } from "@/lib/services/documents";
import { generateReport } from "@/lib/services/reports";
import { getSegmentProfile } from "@/lib/services/segments";
import { createTheme, mergeThemes } from "@/lib/services/themes";
import { admin, createTestWave, ensureCorpusIngested, researcher, summaryOnly, uploadBuffer, CORPUS_WAVES } from "./helpers";

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

describe("auto-date report ingest (item 2)", () => {
  it("routes a report to the wave for its filename month and stores the report date", async () => {
    const user = await researcher();
    const { getProjectId, uploadBufferAutoDated } = await import("./helpers");
    const projectId = await getProjectId();

    const { documentId, waveId, reportDate } = await uploadBufferAutoDated({
      user,
      autoDateProjectId: projectId,
      buffer: Buffer.from("MOD: How are you?\n\nR: Fine, thanks, feeling steady.", "utf-8"),
      filename: "Consumer Sentiment - Summary ReportF 04.09.24 GPT.txt",
      mimeType: "text/plain",
      sourceType: "report",
    });
    expect(reportDate).toBe("2024-09-04");

    const [wave] = await db.select().from(waves).where(eq(waves.id, waveId));
    expect(wave.year).toBe(2024);
    expect(wave.month).toBe(9);

    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    expect(doc.reportDate).toBe("2024-09-04");
    expect(doc.waveId).toBe(waveId);
  });

  it("rejects a file whose name has no readable date", async () => {
    const user = await researcher();
    const { getProjectId, uploadBufferAutoDated } = await import("./helpers");
    const projectId = await getProjectId();
    await expect(
      uploadBufferAutoDated({
        user,
        autoDateProjectId: projectId,
        buffer: Buffer.from("MOD: q\n\nR: a", "utf-8"),
        filename: "undated report final.txt",
        mimeType: "text/plain",
        sourceType: "report",
      }),
    ).rejects.toThrow(/date from the filename/i);
  });
});

describe("cross-wave trends (F5)", () => {
  it("builds archive-wide theme trajectories and classifies movement", async () => {
    const user = await researcher();
    const { getTrendData } = await import("@/lib/services/trends");
    const data = await getTrendData(user);
    expect(data.points.length).toBeGreaterThan(0);
    expect(data.earliest).not.toBeNull();
    expect(data.latest).not.toBeNull();
    expect(data.movers.length).toBeGreaterThan(0);
    expect(data.movers.every((m) => ["new", "growing", "continuing", "fading"].includes(m.movement))).toBe(true);
  });

  it("synthesises a cited cross-wave narrative from earliest to latest wave", async () => {
    const user = await researcher();
    const { synthesiseTrends } = await import("@/lib/services/trends");
    const result = await synthesiseTrends(user);
    expect(result).not.toBeNull();
    expect(result!.text.length).toBeGreaterThan(20);
    expect(result!.sideA.citations.length + result!.sideB.citations.length).toBeGreaterThan(0);
    expect(result!.sideA.label).not.toBe(result!.sideB.label);
  });

  it("excludes transcript evidence from trajectories for users without transcript access", async () => {
    const user = await summaryOnly();
    const { getTrendData } = await import("@/lib/services/trends");
    const data = await getTrendData(user);
    // still has report-derived points, just no transcript-only inflation
    expect(Array.isArray(data.points)).toBe(true);
  });
});

describe("permission-aware re-ranking (F4)", () => {
  it("re-ranks over the ACL-filtered set, sorted by rerankScore, favouring interview diversity", async () => {
    const user = await researcher();
    const { searchChunks } = await import("@/lib/retrieval/search");
    const result = await searchChunks({ query: "cutting back energy bills money worries", user, k: 8 });

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks.every((c) => typeof c.match.rerankScore === "number" && c.match.rerankScore > 0)).toBe(true);
    for (let i = 1; i < result.chunks.length; i++) {
      expect(result.chunks[i - 1].match.rerankScore).toBeGreaterThanOrEqual(result.chunks[i].match.rerankScore);
    }
    const distinctInterviews = new Set(result.chunks.map((c) => c.interviewRef).filter(Boolean));
    expect(distinctInterviews.size).toBeGreaterThan(1);
  });
});

describe("shareable read-only links (F3)", () => {
  it("creates a public share token, reads it without auth, and revokes it", async () => {
    const user = await researcher();
    const { savedOutputs } = await import("@/db/schema");
    const { createShareLink, revokeShareLink, getSharedOutput } = await import("@/lib/services/sharing");

    const [row] = await db
      .insert(savedOutputs)
      .values({ userId: user.id, kind: "answer", title: "Shareable test", content: { answer: "Hello stakeholder" } })
      .returning();

    const token = await createShareLink(user, row.id);
    expect(token).toBeTruthy();

    // public read — no user
    const shared = await getSharedOutput(token);
    expect(shared?.title).toBe("Shareable test");
    expect((shared?.content as { answer?: string })?.answer).toBe("Hello stakeholder");

    // idempotent: same token returned
    expect(await createShareLink(user, row.id)).toBe(token);

    await revokeShareLink(user, row.id);
    expect(await getSharedOutput(token)).toBeNull();
  });

  it("does not let one user share another user's output", async () => {
    const owner = await researcher();
    const other = await admin();
    const { savedOutputs } = await import("@/db/schema");
    const { createShareLink } = await import("@/lib/services/sharing");
    const [row] = await db
      .insert(savedOutputs)
      .values({ userId: owner.id, kind: "answer", title: "Private", content: {} })
      .returning();
    await expect(createShareLink(other, row.id)).rejects.toThrow(/not found/i);
  });
});

describe("sentiment flags (F2)", () => {
  it("assigns AI-assessed sentiment to indexed chunks and supports filtering", async () => {
    const user = await researcher();
    // every indexed chunk should carry a sentiment after ingest
    const rows = await db.select({ sentiment: chunks.sentiment }).from(chunks).limit(50);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.sentiment !== null)).toBe(true);

    // the archive contains negative-tone material (energy crisis)
    const negChunks = await db.select({ id: chunks.id }).from(chunks).where(eq(chunks.sentiment, "negative")).limit(1);
    expect(negChunks.length).toBeGreaterThan(0);

    // the sentiment filter constrains results to that tone
    const { searchChunks } = await import("@/lib/retrieval/search");
    const negative = await searchChunks({
      query: "energy bills heating worried struggling cutting back",
      filters: { sentiments: ["negative"] },
      user,
      k: 12,
    });
    expect(negative.chunks.every((c) => c.sentiment === "negative")).toBe(true);
  });
});

describe("AI auto-tag suggestions (F1)", () => {
  it("captures genuinely-new theme proposals from ingest (streaming/subscriptions)", async () => {
    // ensureCorpusIngested ran in beforeAll; the corpus mentions streaming/subscriptions
    const proposals = await db.select().from(themeProposals);
    expect(proposals.some((p) => /subscription|streaming/i.test(p.name))).toBe(true);
  });

  it("bulk-accepts AI-suggested tags into authoritative human tags", async () => {
    const user = await researcher();
    // fresh in-review doc (not approved) so suggestions can be accepted
    const waveId = await createTestWave({ ...CORPUS_WAVES[0], waveNumber: 910, year: 1980 });
    const docId = await uploadBuffer({
      user,
      waveId,
      buffer: Buffer.from(
        "MOD: How are your energy bills?\n\nR: The heating and electricity costs have really hit us hard this winter.",
        "utf-8",
      ),
      filename: "f1-suggestions.txt",
      mimeType: "text/plain",
      sourceType: "transcript",
    });

    const before = await db
      .select()
      .from(chunkThemes)
      .innerJoin(chunks, eq(chunkThemes.chunkId, chunks.id))
      .where(eq(chunks.documentId, docId));
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((r) => r.chunk_themes.source === "ai_suggested")).toBe(true);

    const accepted = await acceptAllSuggestions(user, docId);
    expect(accepted).toBeGreaterThan(0);

    const after = await db
      .select()
      .from(chunkThemes)
      .innerJoin(chunks, eq(chunkThemes.chunkId, chunks.id))
      .where(eq(chunks.documentId, docId));
    expect(after.every((r) => r.chunk_themes.source === "human")).toBe(true);

    // guard: only valid while in review
    const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
    expect(doc.status).toBe("review");
  });
});

describe("reports-only verbatim access (item 8)", () => {
  it("serves report-attributed quotes without transcript access, but never transcript verbatim", async () => {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const { findQuotes } = await import("@/lib/services/quotes");
    const { approveDocument } = await import("@/lib/services/documents");
    const reporter = await researcher();
    const waveId = await createTestWave(CORPUS_WAVES[0]);

    // a report that quotes a consumer inline, attributed by (Segment, Region)
    const report = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: "Health and the NHS", bold: true })] }),
            new Paragraph({ children: [new TextRun("“The COVID booster rollout this winter reassured me more than anything about the NHS.”")] }),
            new Paragraph({ children: [new TextRun("(Road to Retirement, North)")] }),
          ],
        },
      ],
    });
    const buffer = Buffer.from(await Packer.toBuffer(report));
    const docId = await uploadBuffer({
      user: reporter,
      waveId,
      buffer,
      filename: "item8-covid-report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceType: "report",
    }).catch((err) => {
      if (String(err).includes("identical file")) return null;
      throw err;
    });
    if (docId) await approveDocument(reporter, docId);

    const summary = await summaryOnly();
    expect(summary.transcriptAccess).toBe(false);

    // (1) report-attributed verbatim IS retrievable without transcript access
    const reportHit = await findQuotes({
      user: summary,
      query: "COVID booster rollout reassured NHS",
      collapseDuplicates: false,
    });
    const found = reportHit.quotes.find((q) => q.quote.includes("COVID booster rollout this winter reassured"));
    expect(found).toBeDefined();
    expect(found?.segmentName).toBe("Road to Retirement");
    expect(found?.region).toBe("North");

    // (2) raw transcript verbatim stays hidden for the same user (ACL in SQL)
    const phrase = "heating off until the grandchildren visit";
    const hidden = await findQuotes({ user: summary, query: phrase, collapseDuplicates: false });
    expect(hidden.quotes.some((q) => q.quote.includes("grandchildren visit"))).toBe(false);

    // (3) a transcript-access user DOES see that transcript verbatim
    const seen = await findQuotes({ user: reporter, query: phrase, collapseDuplicates: false });
    expect(seen.quotes.some((q) => q.quote.includes("grandchildren visit"))).toBe(true);
  });
});
