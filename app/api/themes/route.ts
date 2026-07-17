import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { createTheme, listThemes } from "@/lib/services/themes";
import { requireRole, requireUser } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  definition: z.string().max(2000).optional(),
});

export async function GET() {
  return handleApi(async () => {
    await requireUser();
    return listThemes();
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireRole("admin");
    const body = createSchema.parse(await req.json());
    return createTheme(user, body, clientIp(req));
  });
}
