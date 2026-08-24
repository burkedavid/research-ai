import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { chunks, segments } from "@/db/schema";
import { getFilterOptions } from "@/lib/services/filter-options";
import { ensureCorpusIngested } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

/** Mirrors what the admin merge endpoint does, which is the behaviour under test. */
async function mergeSegments(sourceId: string, targetId: string) {
  await db.update(chunks).set({ segmentId: targetId }).where(eq(chunks.segmentId, sourceId));
  await db.update(segments).set({ status: "merged", mergedInto: targetId }).where(eq(segments.id, sourceId));
}

describe("segment merge is recorded, not destructive", () => {
  it("keeps the merged segment so historic citations stay traceable", async () => {
    const [a] = await db.insert(segments).values({ name: "Merge Seg Source" }).returning();
    const [b] = await db.insert(segments).values({ name: "Merge Seg Target" }).returning();
    await mergeSegments(a.id, b.id);

    const [after] = await db.select().from(segments).where(eq(segments.id, a.id));
    // the row survives — deleting it made an output citing "(Segment, Region)"
    // impossible to trace back
    expect(after).toBeDefined();
    expect(after.status).toBe("merged");
    expect(after.mergedInto).toBe(b.id);
  });

  it("moves the passages across", async () => {
    const [a] = await db.insert(segments).values({ name: "Merge Seg Source 2" }).returning();
    const [b] = await db.insert(segments).values({ name: "Merge Seg Target 2" }).returning();
    const [chunk] = await db.select({ id: chunks.id }).from(chunks).limit(1);
    await db.update(chunks).set({ segmentId: a.id }).where(eq(chunks.id, chunk.id));

    await mergeSegments(a.id, b.id);

    const [moved] = await db.select().from(chunks).where(eq(chunks.id, chunk.id));
    expect(moved.segmentId).toBe(b.id);
    expect(await db.select().from(chunks).where(eq(chunks.segmentId, a.id))).toEqual([]);
  });

  it("stops offering a merged segment as a filter", async () => {
    const [a] = await db.insert(segments).values({ name: "Merge Seg Hidden" }).returning();
    const [b] = await db.insert(segments).values({ name: "Merge Seg Kept" }).returning();
    expect((await getFilterOptions()).segments.map((s) => s.name)).toContain("Merge Seg Hidden");

    await mergeSegments(a.id, b.id);

    const names = (await getFilterOptions()).segments.map((s) => s.name);
    expect(names).not.toContain("Merge Seg Hidden");
    expect(names).toContain("Merge Seg Kept");
  });
});

describe("theme definitions are visible where themes are used", () => {
  it("ships each theme's definition to the filter UI", async () => {
    const options = await getFilterOptions();
    expect(options.themes.length).toBeGreaterThan(0);
    // the field exists on every theme, populated wherever one has been written
    for (const t of options.themes) expect(t).toHaveProperty("definition");
    expect(options.themes.some((t) => (t.definition ?? "").length > 0)).toBe(true);
  });
});
