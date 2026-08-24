import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { projects, waves } from "@/db/schema";
import { findOrCreateWave, renumberWavesChronologically } from "@/lib/services/waves";
import { admin, ensureCorpusIngested, researcher } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

async function freshProject(name: string): Promise<string> {
  const [existing] = await db.select().from(projects).where(eq(projects.name, name));
  if (existing) return existing.id;
  const [any] = await db.select().from(projects);
  const [row] = await db.insert(projects).values({ name, clientId: any.clientId }).returning({ id: projects.id });
  return row.id;
}

async function numbersInDateOrder(projectId: string): Promise<number[]> {
  const rows = await db
    .select({ n: waves.waveNumber })
    .from(waves)
    .where(eq(waves.projectId, projectId))
    .orderBy(waves.year, waves.month);
  return rows.map((r) => r.n);
}

describe("wave numbering after a back-catalogue import", () => {
  it("reproduces the newest-first import leaving duplicate numbers, and fixes it", async () => {
    const projectId = await freshProject("Numbering Test Monitor");

    // exactly what bulk upload does when the newest report is processed first
    const uploader = await researcher();
    for (const month of [8, 7, 6, 5, 4, 3, 2, 1]) {
      await findOrCreateWave(uploader, { projectId, year: 2026, month });
    }

    const before = await numbersInDateOrder(projectId);
    // the bug: nothing distinguishes these waves in the UI
    expect(new Set(before).size).toBeLessThan(before.length);

    const who = await admin();
    const { renumbered } = await renumberWavesChronologically(who, projectId);
    expect(renumbered).toBeGreaterThan(0);

    expect(await numbersInDateOrder(projectId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("is idempotent — running it again changes nothing", async () => {
    const projectId = await freshProject("Numbering Test Monitor");
    const who = await admin();
    const { renumbered } = await renumberWavesChronologically(who, projectId);
    expect(renumbered).toBe(0);
    expect(await numbersInDateOrder(projectId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("is admin-only — a researcher cannot renumber a project", async () => {
    const projectId = await freshProject("Numbering Test Monitor");
    await expect(renumberWavesChronologically(await researcher(), projectId)).rejects.toThrow(/admin/i);
  });

  it("leaves other projects alone", async () => {
    const projectId = await freshProject("Numbering Test Monitor");
    const [other] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.name, "Consumer Sentiment Monitor")));
    if (!other) return;
    const seeded = await numbersInDateOrder(other.id);
    await renumberWavesChronologically(await admin(), projectId);
    expect(await numbersInDateOrder(other.id)).toEqual(seeded);
  });
});
