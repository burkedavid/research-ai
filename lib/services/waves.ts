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
