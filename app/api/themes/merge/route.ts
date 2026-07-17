import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { mergeThemes } from "@/lib/services/themes";
import { requireRole } from "@/lib/session";

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireRole("admin");
    const { sourceId, targetId } = mergeSchema.parse(await req.json());
    await mergeThemes(user, sourceId, targetId, clientIp(req));
  });
}
