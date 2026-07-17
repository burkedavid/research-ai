import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "researcher", "viewer"]),
  transcriptAccess: z.boolean().default(false),
});

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "researcher", "viewer"]).optional(),
  transcriptAccess: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = createSchema.parse(await req.json());
    const [row] = await db
      .insert(users)
      .values({ email: body.email.toLowerCase(), name: body.name, role: body.role, transcriptAccess: body.transcriptAccess })
      .returning();
    await audit({
      userId: admin.id,
      action: "permission_change",
      entityType: "user",
      entityId: row.id,
      detail: { op: "create", role: body.role, transcriptAccess: body.transcriptAccess },
      ip: clientIp(req),
    });
    return row;
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    if (body.userId === admin.id && (body.active === false || (body.role && body.role !== "admin"))) {
      throw new Error("You cannot suspend or demote your own account");
    }
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.role !== undefined) set.role = body.role;
    if (body.transcriptAccess !== undefined) set.transcriptAccess = body.transcriptAccess;
    if (body.active !== undefined) set.active = body.active;
    await db.update(users).set(set).where(eq(users.id, body.userId));
    await audit({
      userId: admin.id,
      action: "permission_change",
      entityType: "user",
      entityId: body.userId,
      detail: { op: "update", ...set },
      ip: clientIp(req),
    });
  });
}
