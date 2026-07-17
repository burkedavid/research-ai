import { clientIp, handleApi } from "@/lib/api";
import { acceptAllSuggestions } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const accepted = await acceptAllSuggestions(user, id, clientIp(req));
    return { accepted };
  });
}
