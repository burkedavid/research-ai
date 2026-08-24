import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { chunkThemes, taxonomyRevisions, themes } from "@/db/schema";
import { createTheme, mergeThemes, updateThemeDefinition } from "@/lib/services/themes";
import { admin, ensureCorpusIngested } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

describe("taxonomy provenance (step 1)", () => {
  it("logs a revision for every kind of taxonomy change", async () => {
    const who = await admin();
    const before = await db.select().from(taxonomyRevisions);

    const created = await createTheme(who, { name: `Retag Probe ${before.length}`, definition: "probe" });
    await updateThemeDefinition(who, created.id, "a sharper definition");

    const after = await db.select().from(taxonomyRevisions).orderBy(desc(taxonomyRevisions.id));
    expect(after.length).toBe(before.length + 2);
    expect(after[0].kind).toBe("define");
    expect(after[1].kind).toBe("create");
    // the name is captured on the row so history survives a later rename/merge
    expect(after[1].themeName).toContain("Retag Probe");
    expect(after[0].actorId).toBe(who.id);
  });

  it("gives the taxonomy a monotone version with no read-modify-write", async () => {
    const who = await admin();
    const [top] = await db.select().from(taxonomyRevisions).orderBy(desc(taxonomyRevisions.id)).limit(1);
    const created = await createTheme(who, { name: `Monotone Probe ${top?.id ?? 0}` });
    const [next] = await db.select().from(taxonomyRevisions).orderBy(desc(taxonomyRevisions.id)).limit(1);
    expect(next.id).toBeGreaterThan(top?.id ?? 0);
    expect(next.themeId).toBe(created.id);
  });

  it("records a merge as a revision, naming what was folded in", async () => {
    const who = await admin();
    const a = await createTheme(who, { name: "Merge Probe Source" });
    const b = await createTheme(who, { name: "Merge Probe Target" });
    await mergeThemes(who, a.id, b.id);
    const [rev] = await db.select().from(taxonomyRevisions).orderBy(desc(taxonomyRevisions.id)).limit(1);
    expect(rev.kind).toBe("merge");
    expect(rev.themeId).toBe(b.id);
    expect((rev.detail as { mergedFrom?: string }).mergedFrom).toBe("Merge Probe Source");
  });

  it("stamps definition changes so a stale definition is detectable", async () => {
    const who = await admin();
    const t = await createTheme(who, { name: "Definition Stamp Probe" });
    const [fresh] = await db.select().from(themes).where(eq(themes.id, t.id));
    expect(fresh.definitionUpdatedAt).toBeNull();
    await updateThemeDefinition(who, t.id, "now defined");
    const [updated] = await db.select().from(themes).where(eq(themes.id, t.id));
    expect(updated.definitionUpdatedAt).toBeInstanceOf(Date);
  });

  it("every existing tag carries provenance", async () => {
    const rows = await db.select().from(chunkThemes).limit(50);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.createdAt).toBeInstanceOf(Date);
      // ai tags name the model that produced them; human tags do not
      if (r.source === "human") expect(r.model).toBeNull();
    }
  });
});

describe("the tagger sees theme definitions (step 0)", () => {
  it("sends each definition alongside its name", async () => {
    const { buildTaxonomyPromptLines } = await import("@/lib/ingestion/suggest");
    const lines = buildTaxonomyPromptLines([
      { name: "Housing", definition: "Cost, quality and security of where people live" },
      { name: "Energy and fuel", definition: null },
    ]);
    const text = lines.join("\n");
    expect(text).toContain("Housing: Cost, quality and security of where people live");
    // a theme with no definition still appears, just bare
    expect(text).toContain("- Energy and fuel");
    expect(text).not.toContain("Energy and fuel:");
  });
});
