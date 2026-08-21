import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chunks, segments } from "@/db/schema";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

const patchSchema = z.object({
  segmentId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

/** Segments with live usage counts — a zero count is the signal that report
 *  attributions aren't matching this segment's name. */
export async function GET() {
  return handleApi(async () => {
    await requireRole("admin");
    return (await db.execute(sql`
      SELECT s.id, s.name, s.description,
             count(DISTINCT c.id)::int AS chunk_count,
             count(DISTINCT c.interview_id)::int AS interview_count
      FROM segments s
      LEFT JOIN chunks c ON c.segment_id = s.id
      GROUP BY s.id, s.name, s.description
      ORDER BY s.name
    `)) as unknown as { id: string; name: string; description: string | null; chunk_count: number; interview_count: number }[];
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = createSchema.parse(await req.json());
    const [row] = await db
      .insert(segments)
      .values({ name: body.name, description: body.description ?? null })
      .returning();
    await audit({
      userId: admin.id,
      action: "segment_edit",
      entityType: "segment",
      entityId: row.id,
      detail: { op: "create", name: body.name },
      ip: clientIp(req),
    });
    return row;
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    await db.update(segments).set(patch).where(eq(segments.id, body.segmentId));
    await audit({
      userId: admin.id,
      action: "segment_edit",
      entityType: "segment",
      entityId: body.segmentId,
      detail: { op: "update", ...patch },
      ip: clientIp(req),
    });
  });
}

/**
 * Merge one segment into another: chunks are repointed, then the now-unused
 * source row is removed. Segments carry no status column (unlike themes), so a
 * merge is only allowed to a different existing segment and is recorded in the
 * audit log with the moved-chunk count for traceability.
 */
export async function PUT(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = mergeSchema.parse(await req.json());
    if (body.sourceId === body.targetId) throw new Error("Cannot merge a segment into itself");

    const moved = await db
      .update(chunks)
      .set({ segmentId: body.targetId })
      .where(eq(chunks.segmentId, body.sourceId))
      .returning({ id: chunks.id });
    await db.delete(segments).where(eq(segments.id, body.sourceId));

    await audit({
      userId: admin.id,
      action: "segment_edit",
      entityType: "segment",
      entityId: body.sourceId,
      detail: { op: "merge", into: body.targetId, chunksMoved: moved.length },
      ip: clientIp(req),
    });
    return { chunksMoved: moved.length };
  });
}
