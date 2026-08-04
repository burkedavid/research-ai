import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, projects, waves } from "@/db/schema";
import { ForbiddenError, type SessionUser } from "@/lib/errors";

export async function listWaves() {
  return db
    .select({
      id: waves.id,
      waveNumber: waves.waveNumber,
      month: waves.month,
      year: waves.year,
      status: waves.status,
      keyEvents: waves.keyEvents,
      projectName: projects.name,
      documentCount: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.wave_id = ${waves.id} AND d.status <> 'deleted')`,
      indexedCount: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.wave_id = ${waves.id} AND d.status = 'indexed')`,
    })
    .from(waves)
    .innerJoin(projects, eq(waves.projectId, projects.id))
    .orderBy(desc(waves.year), desc(waves.month));
}

export async function createWave(
  user: SessionUser,
  params: { projectId: string; waveNumber: number; month: number; year: number; keyEvents?: string[]; fieldworkNotes?: string },
) {
  if (user.role === "viewer") throw new ForbiddenError("Requires researcher role");
  const [wave] = await db
    .insert(waves)
    .values({
      projectId: params.projectId,
      waveNumber: params.waveNumber,
      month: params.month,
      year: params.year,
      keyEvents: params.keyEvents,
      fieldworkNotes: params.fieldworkNotes,
    })
    .returning();
  return wave;
}

/**
 * Find or create the wave for a given project + month (item 2). Reports of any
 * cadence within a month share one wave; the day-level date lives on the
 * document. Wave number is assigned incrementally per project by chronology.
 */
export async function findOrCreateWave(
  user: SessionUser,
  params: { projectId: string; year: number; month: number },
): Promise<string> {
  if (user.role === "viewer") throw new ForbiddenError("Requires researcher role");
  const [existing] = await db
    .select({ id: waves.id })
    .from(waves)
    .where(and(eq(waves.projectId, params.projectId), eq(waves.year, params.year), eq(waves.month, params.month)));
  if (existing) return existing.id;

  // wave number = chronological rank among this project's waves
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(waves)
    .where(
      and(
        eq(waves.projectId, params.projectId),
        sql`(${waves.year} * 100 + ${waves.month}) < ${params.year * 100 + params.month}`,
      ),
    );
  const [wave] = await db
    .insert(waves)
    .values({ projectId: params.projectId, year: params.year, month: params.month, waveNumber: count + 1 })
    .onConflictDoNothing({ target: [waves.projectId, waves.year, waves.month] })
    .returning({ id: waves.id });
  if (wave) return wave.id;
  // race: another upload created it first
  const [row] = await db
    .select({ id: waves.id })
    .from(waves)
    .where(and(eq(waves.projectId, params.projectId), eq(waves.year, params.year), eq(waves.month, params.month)));
  return row.id;
}

/** Monthly workflow (§B6): wave is confirmed once every document is reviewed. */
export async function confirmWave(user: SessionUser, waveId: string) {
  if (user.role === "viewer") throw new ForbiddenError("Requires researcher role");
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.waveId, waveId),
        sql`${documents.status} IN ('uploaded','parsing','review','approved')`,
      ),
    );
  if (pending.count > 0) {
    throw new Error(`${pending.count} document(s) are still awaiting review or indexing`);
  }
  const [hasIndexed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.waveId, waveId), eq(documents.status, "indexed")));
  if (hasIndexed.count === 0) {
    throw new Error("A wave needs at least one indexed document before it can be confirmed");
  }
  await db.update(waves).set({ status: "confirmed" }).where(and(eq(waves.id, waveId), ne(waves.status, "confirmed")));
}

export async function getWaveWithDocuments(waveId: string) {
  const [wave] = await db
    .select({
      id: waves.id,
      waveNumber: waves.waveNumber,
      month: waves.month,
      year: waves.year,
      status: waves.status,
      keyEvents: waves.keyEvents,
      fieldworkNotes: waves.fieldworkNotes,
      projectId: waves.projectId,
      projectName: projects.name,
    })
    .from(waves)
    .innerJoin(projects, eq(waves.projectId, projects.id))
    .where(eq(waves.id, waveId));
  if (!wave) return null;
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.waveId, waveId), ne(documents.status, "deleted")))
    .orderBy(desc(documents.createdAt));
  return { wave, documents: docs };
}
