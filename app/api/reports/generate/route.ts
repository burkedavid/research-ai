import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { generateReport } from "@/lib/services/reports";
import { requireUser } from "@/lib/session";

const generateSchema = z.object({
  template: z.enum(["monthly_summary", "theme_deep_dive", "what_changed"]),
  waveId: z.string().uuid().optional(),
  themeId: z.string().uuid().optional(),
  themeName: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = generateSchema.parse(await req.json());
    return generateReport({ user, ...body, ip: clientIp(req) });
  });
}
