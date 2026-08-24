import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, projects, waves } from "@/db/schema";
import { audit } from "@/lib/audit";
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

  // Best-effort wave number: chronological rank at the moment of creation.
  // It is only a guess — importing a back-catalogue newest-first numbers every
  // wave 1, because no earlier wave exists yet when each one is created. An
  // admin can put a project straight with renumberWavesChronologically().
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

/**
 * Correct a wave's details (§A14). A confirmed wave is locked — reopening it
 * would silently change the period that indexed evidence is filed under.
 */
export async function updateWave(
  user: SessionUser,
  waveId: string,
  patch: { waveNumber?: number; month?: number; year?: number; fieldworkNotes?: string | null; keyEvents?: string[] | null },
  ip?: string | null,
) {
  if (user.role === "viewer") throw new ForbiddenError("Requires researcher role");
  const [wave] = await db.select().from(waves).where(eq(waves.id, waveId));
  if (!wave) throw new Error("Wave not found");
  if (wave.status === "confirmed") throw new Error("A confirmed wave cannot be edited");

  const values: Record<string, unknown> = {};
  if (patch.waveNumber !== undefined) values.waveNumber = patch.waveNumber;
  if (patch.month !== undefined) values.month = patch.month;
  if (patch.year !== undefined) values.year = patch.year;
  if (patch.fieldworkNotes !== undefined) values.fieldworkNotes = patch.fieldworkNotes;
  if (patch.keyEvents !== undefined) values.keyEvents = patch.keyEvents;
  if (Object.keys(values).length === 0) return;

  await db.update(waves).set(values).where(eq(waves.id, waveId));
  await audit({
    userId: user.id,
    action: "wave_edit",
    entityType: "wave",
    entityId: waveId,
    detail: { op: "update", ...values },
    ip,
  });
}

/**
 * Remove an empty wave — created by mistake, or auto-created from a mistyped
 * filename during bulk upload. Deliberately refuses while documents exist:
 * those must be deleted individually so the §B5 deletion contract (blob +
 * chunks + tsv + embeddings) is honoured and audited per document.
 */
export async function deleteWave(user: SessionUser, waveId: string, ip?: string | null) {
  if (user.role !== "admin") throw new ForbiddenError("Requires admin role");
  const [docs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.waveId, waveId));
  if (docs.count > 0) {
    throw new Error(`Wave still has ${docs.count} document(s) — delete those first`);
  }
  await db.delete(waves).where(eq(waves.id, waveId));
  await audit({ userId: user.id, action: "delete", entityType: "wave", entityId: waveId, detail: { op: "delete_empty_wave" }, ip });
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

/**
 * Renumber a project's waves 1..n in date order.
 *
 * Auto-created waves (bulk upload) get their number from however many earlier
 * waves happened to exist at the moment they were created, so loading a
 * back-catalogue newest-first leaves every wave numbered 1. The number is only
 * ever a guess: a real archive's wave numbers are a property of the fieldwork
 * series, not of what has been loaded — an archive holding only waves 32 and 76
 * of 76 must keep those numbers, which is why this is an explicit admin action
 * and not something that runs on every upload.
 *
 * It renumbers confirmed waves too. The confirmed lock exists to stop the
 * PERIOD of indexed evidence changing silently; the number is a label, and
 * leaving confirmed waves out would produce duplicates alongside renumbered
 * drafts. This is deliberate, audited, and admin-only.
 */
export async function renumberWavesChronologically(
  user: SessionUser,
  projectId: string,
  ip?: string | null,
): Promise<{ renumbered: number }> {
  if (user.role !== "admin") throw new ForbiddenError("Requires admin role");

  const rows = await db
    .select({ id: waves.id, waveNumber: waves.waveNumber, year: waves.year, month: waves.month })
    .from(waves)
    .where(eq(waves.projectId, projectId))
    .orderBy(waves.year, waves.month);

  let renumbered = 0;
  for (const [i, row] of rows.entries()) {
    const next = i + 1;
    if (row.waveNumber === next) continue;
    await db.update(waves).set({ waveNumber: next }).where(eq(waves.id, row.id));
    renumbered += 1;
  }

  if (renumbered > 0) {
    await audit({
      userId: user.id,
      action: "wave_edit",
      entityType: "project",
      entityId: projectId,
      detail: { op: "renumber", renumbered, total: rows.length },
      ip,
    });
  }
  return { renumbered };
}
