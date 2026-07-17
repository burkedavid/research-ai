import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const patchSchema = z.object({
  projectId: z.string().uuid(),
  retentionMonths: z.number().int().min(1).max(600).nullable(),
});

/** Retention settings (§A13.1): enforced nightly by the retention cron. */
export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    await db.update(projects).set({ retentionMonths: body.retentionMonths }).where(eq(projects.id, body.projectId));
    await audit({
      userId: admin.id,
      action: "permission_change",
      entityType: "project",
      entityId: body.projectId,
      detail: { op: "retention", retentionMonths: body.retentionMonths },
      ip: clientIp(req),
    });
  });
}
