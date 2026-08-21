import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { setSuggestions } from "@/lib/services/suggestions";
import { requireRole } from "@/lib/session";

const askItem = z.object({ category: z.string().min(1).max(60), question: z.string().min(1).max(300) });

const patchSchema = z.discriminatedUnion("kind", [
  /** null resets to the list derived from the indexed archive */
  z.object({ kind: z.literal("ask"), items: z.array(askItem).max(12).nullable() }),
  z.object({ kind: z.literal("quotes"), items: z.array(z.string().min(1).max(120)).max(12).nullable() }),
]);

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await req.json());
    await setSuggestions(body.kind, body.items, admin.id);
    await audit({
      userId: admin.id,
      action: "permission_change",
      entityType: "suggestions",
      entityId: body.kind,
      detail: {
        op: "suggestions_change",
        kind: body.kind,
        count: body.items?.length ?? 0,
        reset: body.items === null,
      },
      ip: clientIp(req),
    });
  });
}
