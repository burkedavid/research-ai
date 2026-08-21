import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const createSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(160),
  lawfulBasis: z.string().max(500).optional(),
  retentionMonths: z.number().int().min(1).max(600).nullable().optional(),
});

const patchSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  lawfulBasis: z.string().max(500).nullable().optional(),
  retentionMonths: z.number().int().min(1).max(600).nullable().optional(),
});

/** Projects with their client and wave counts. */
export async function GET() {
  return handleApi(async () => {
    await requireRole("admin");
    return (await db.execute(sql`
      SELECT p.id, p.name, p.lawful_basis, p.retention_months,
             c.id AS client_id, c.name AS client_name,
             count(w.id)::int AS wave_count
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN waves w ON w.project_id = p.id
      GROUP BY p.id, p.name, p.lawful_basis, p.retention_months, c.id, c.name
      ORDER BY c.name, p.name
    `)) as unknown as Record<string, unknown>[];
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = createSchema.parse(await req.json());
    const [row] = await db
      .insert(projects)
      .values({
        clientId: body.clientId,
        name: body.name,
        lawfulBasis: body.lawfulBasis ?? null,
        retentionMonths: body.retentionMonths ?? null,
      })
      .returning();
    await audit({
      userId: admin.id,
      action: "project_edit",
      entityType: "project",
      entityId: row.id,
      detail: { op: "create", name: body.name, clientId: body.clientId },
      ip: clientIp(req),
    });
    return row;
  });
}

/** Project settings, including retention (§A13.1), enforced by the nightly cron. */
export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.lawfulBasis !== undefined) patch.lawfulBasis = body.lawfulBasis;
    if (body.retentionMonths !== undefined) patch.retentionMonths = body.retentionMonths;
    await db.update(projects).set(patch).where(eq(projects.id, body.projectId));
    await audit({
      userId: admin.id,
      action: body.retentionMonths !== undefined && Object.keys(patch).length === 1 ? "permission_change" : "project_edit",
      entityType: "project",
      entityId: body.projectId,
      detail: Object.keys(patch).length === 1 && patch.retentionMonths !== undefined
        ? { op: "retention", retentionMonths: body.retentionMonths }
        : { op: "update", ...patch },
      ip: clientIp(req),
    });
  });
}
