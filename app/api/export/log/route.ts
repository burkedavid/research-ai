import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

const logSchema = z.object({
  what: z.string().min(1).max(200),
  format: z.enum(["clipboard", "image"]),
  itemCount: z.number().int().min(0).optional(),
});

/**
 * Client-side exports (copy-to-clipboard, chart image downloads) happen in the
 * browser; this endpoint gives them an audit trail (§B9.3).
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = logSchema.parse(await req.json());
    await audit({
      userId: user.id,
      action: "export",
      entityType: "clipboard",
      detail: body,
      ip: clientIp(req),
    });
  });
}
