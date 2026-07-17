import { clientIp, handleApi } from "@/lib/api";
import { deleteDocument } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await deleteDocument(user, id, clientIp(req));
  });
}
