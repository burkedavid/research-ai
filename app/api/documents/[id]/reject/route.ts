import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { rejectDocument } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

const rejectSchema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { reason } = rejectSchema.parse(await req.json());
    await rejectDocument(user, id, reason, clientIp(req));
  });
}
