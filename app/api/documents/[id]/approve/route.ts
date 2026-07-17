import { clientIp, handleApi } from "@/lib/api";
import { approveDocument } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await approveDocument(user, id, clientIp(req));
  });
}
