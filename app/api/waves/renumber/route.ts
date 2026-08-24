import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { renumberWavesChronologically } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";

const schema = z.object({ projectId: z.string().uuid() });

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const { projectId } = schema.parse(await req.json());
    return renumberWavesChronologically(user, projectId, clientIp(req));
  });
}
