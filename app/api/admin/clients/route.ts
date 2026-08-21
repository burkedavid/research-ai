import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(160),
  notes: z.string().max(1000).optional(),
});

const patchSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** Clients with their project counts. */
export async function GET() {
  return handleApi(async () => {
    await requireRole("admin");
    return (await db.execute(sql`
      SELECT c.id, c.name, c.notes, count(p.id)::int AS project_count
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id
      GROUP BY c.id, c.name, c.notes
      ORDER BY c.name
    `)) as unknown as { id: string; name: string; notes: string | null; project_count: number }[];
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = createSchema.parse(await req.json());
    const [row] = await db.insert(clients).values({ name: body.name, notes: body.notes ?? null }).returning();
    await audit({
      userId: admin.id,
      action: "client_edit",
      entityType: "client",
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
    if (body.notes !== undefined) patch.notes = body.notes;
    await db.update(clients).set(patch).where(eq(clients.id, body.clientId));
    await audit({
      userId: admin.id,
      action: "client_edit",
      entityType: "client",
      entityId: body.clientId,
      detail: { op: "update", ...patch },
      ip: clientIp(req),
    });
  });
}
