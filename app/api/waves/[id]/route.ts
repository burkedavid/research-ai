import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { deleteWave, updateWave } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  waveNumber: z.number().int().min(1).max(9999).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  fieldworkNotes: z.string().max(2000).nullable().optional(),
  keyEvents: z.array(z.string().max(200)).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    await updateWave(user, id, body, clientIp(req));
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await deleteWave(user, id, clientIp(req));
  });
}
