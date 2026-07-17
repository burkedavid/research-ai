import { z } from "zod";
import { handleApi } from "@/lib/api";
import { createWave, listWaves } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";

const createSchema = z.object({
  projectId: z.string().uuid(),
  waveNumber: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  keyEvents: z.array(z.string()).optional(),
  fieldworkNotes: z.string().optional(),
});

export async function GET() {
  return handleApi(async () => {
    await requireUser();
    return listWaves();
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    return createWave(user, body);
  });
}
