import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { chunkThemes, chunks, themeTaggingRuns, themes } from "@/db/schema";
import { dispatchRetagRun } from "@/lib/ingestion/dispatch";
import { createTheme } from "@/lib/services/themes";
import {
  getThemeCoverage,
  incompleteThemeNames,
  planThemeRun,
  retagBatch,
} from "@/lib/services/retag";
import { getTrendData } from "@/lib/services/trends";
import { admin, ensureCorpusIngested, researcher } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

/** A theme added now is, by definition, one the archive was indexed without. */
async function newTheme(name: string, definition: string) {
  return createTheme(await admin(), { name, definition });
}

describe("applying a new theme to an already-indexed archive", () => {
  it("flags a newly-added theme as not covering the archive", async () => {
    const t = await newTheme("Retag Coverage A", "Consumers talking about the cost of energy bills");
    const coverage = await getThemeCoverage();
    const row = coverage.find((c) => c.themeId === t.id);
    expect(row?.incomplete).toBe(true);
    expect(row?.taggedPassages).toBe(0);
  });

  it("selects candidates whatever the embedding provider's distance scale", async () => {
    // an absolute cosine threshold is a property of the model, not of relevance;
    // every theme must find candidates, or a run would claim coverage having
    // read nothing
    for (const [name, definition] of [
      ["Retag Scale A", "Consumers talking about rising prices"],
      ["Retag Scale B", "Consumers describing worries about money"],
      ["Retag Scale C", "Consumers talking about their heating"],
    ] as const) {
      const theme = await newTheme(name, definition);
      const p = await planThemeRun(await admin(), theme.id);
      expect(p.candidates, `${name} selected no candidates`).toBeGreaterThan(0);
    }
  });

  it("prices the work before spending anything on the model", async () => {
    const t = await newTheme("Retag Coverage B", "Consumers cutting back on spending");
    const plan = await planThemeRun(await admin(), t.id);
    expect(plan.candidates).toBeGreaterThan(0);
    expect(plan.estCostGbp).toBeGreaterThanOrEqual(0);
    // planning records the run as pending — nothing is adjudicated yet
    const [run] = await db.select().from(themeTaggingRuns).where(eq(themeTaggingRuns.id, plan.runId));
    expect(run.status).toBe("pending");
    expect(run.candidatesDone).toBe(0);
    expect(run.tagsAdded).toBe(0);
  });

  it("tags passages when run, and reports the theme as covered afterwards", async () => {
    const t = await newTheme("Retag Coverage C", "Consumers describing worries about money");
    const plan = await planThemeRun(await admin(), t.id);
    await dispatchRetagRun(plan.runId);

    const [run] = await db.select().from(themeTaggingRuns).where(eq(themeTaggingRuns.id, plan.runId));
    expect(run.status).toBe("complete");
    // guards a vacuous pass: a run that examined nothing must not read as done
    expect(run.candidatesTotal).toBeGreaterThan(0);
    expect(run.candidatesDone).toBe(run.candidatesTotal);

    const covered = (await getThemeCoverage()).find((c) => c.themeId === t.id);
    expect(covered?.incomplete).toBe(false);
  });

  it("records provenance on every tag it writes", async () => {
    const t = await newTheme("Retag Coverage D", "Consumers talking about food shopping");
    const plan = await planThemeRun(await admin(), t.id);
    expect(plan.candidates).toBeGreaterThan(0);
    await dispatchRetagRun(plan.runId);
    const tags = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, t.id));
    for (const tag of tags) {
      expect(tag.runId).toBe(plan.runId);
      expect(tag.source).toBe("ai_suggested");
      expect(tag.model).toBeTruthy();
    }
  });

  it("never overwrites a tag a reviewer confirmed", async () => {
    const t = await newTheme("Retag Coverage E", "Consumers talking about their bank");
    // a human has already judged one passage for this theme
    const [chunk] = await db.select({ id: chunks.id }).from(chunks).limit(1);
    await db.insert(chunkThemes).values({ chunkId: chunk.id, themeId: t.id, source: "human", confidence: null });

    const plan = await planThemeRun(await admin(), t.id);
    await dispatchRetagRun(plan.runId);

    const [human] = await db
      .select()
      .from(chunkThemes)
      .where(sql`${chunkThemes.themeId} = ${t.id} AND ${chunkThemes.chunkId} = ${chunk.id}`);
    expect(human.source).toBe("human");
    expect(human.runId).toBeNull();
  });

  it("is admin-only", async () => {
    const t = await newTheme("Retag Coverage F", "Anything at all");
    await expect(planThemeRun(await researcher(), t.id)).rejects.toThrow(/admin/i);
  });

  it("is idempotent — a completed run does no further work", async () => {
    const t = await newTheme("Retag Coverage G", "Consumers talking about holidays");
    const plan = await planThemeRun(await admin(), t.id);
    await dispatchRetagRun(plan.runId);
    const before = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, t.id));
    const result = await retagBatch(plan.runId);
    expect(result.remaining).toBe(0);
    const after = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, t.id));
    expect(after.length).toBe(before.length);
  });

  it("does not report an under-covered theme as a NEW trend", async () => {
    // the live bug this guards: a theme added today scores earliest=0 and would
    // be reported as having EMERGED, when it was merely defined
    const t = await newTheme("Retag Coverage H", "Consumers discussing pensions");
    expect(await incompleteThemeNames()).toContain(t.name);

    const trend = await getTrendData(await researcher());
    const mover = trend.movers.find((m) => m.themeName === t.name);
    if (mover) {
      expect(mover.movement).not.toBe("new");
      expect(mover.coverageIncomplete).toBe(true);
    }
  });

  it("leaves other themes' tags completely untouched", async () => {
    const [other] = await db.select().from(themes).where(eq(themes.name, "Energy and fuel"));
    const before = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, other.id));
    const t = await newTheme("Retag Coverage I", "Consumers talking about the weather");
    const plan = await planThemeRun(await admin(), t.id);
    await dispatchRetagRun(plan.runId);
    const after = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, other.id));
    expect(after.length).toBe(before.length);
  });
});
