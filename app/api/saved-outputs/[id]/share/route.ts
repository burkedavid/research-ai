import { clientIp, handleApi } from "@/lib/api";
import { createShareLink, revokeShareLink } from "@/lib/services/sharing";
import { requireUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const token = await createShareLink(user, id, clientIp(req));
    return { token };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await revokeShareLink(user, id, clientIp(req));
  });
}
