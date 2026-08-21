import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { setModel } from "@/lib/services/model-settings";
import { requireRole } from "@/lib/session";

const patchSchema = z.object({
  job: z.enum(["query", "ingestion"]),
  /** null resets the job to the configured default */
  model: z.string().max(120).nullable(),
});

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    await setModel(body.job, body.model, admin.id);
    await audit({
      userId: admin.id,
      action: "permission_change",
      entityType: "model",
      entityId: body.job,
      detail: { op: "model_change", job: body.job, model: body.model ?? "(default)" },
      ip: clientIp(req),
    });
  });
}
