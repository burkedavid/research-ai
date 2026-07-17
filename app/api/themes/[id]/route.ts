import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { updateThemeDefinition } from "@/lib/services/themes";
import { requireRole } from "@/lib/session";

const patchSchema = z.object({ definition: z.string().max(2000) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireRole("admin");
    const { id } = await params;
    const { definition } = patchSchema.parse(await req.json());
    await updateThemeDefinition(user, id, definition, clientIp(req));
  });
}
