import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { dismissThemeProposal, promoteThemeProposal } from "@/lib/services/themes";
import { requireRole } from "@/lib/session";

const schema = z.object({ action: z.enum(["promote", "dismiss"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireRole("admin");
    const { id } = await params;
    const { action } = schema.parse(await req.json());
    if (action === "promote") await promoteThemeProposal(user, id, clientIp(req));
    else await dismissThemeProposal(user, id, clientIp(req));
  });
}
