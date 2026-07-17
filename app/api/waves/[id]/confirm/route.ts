import { handleApi } from "@/lib/api";
import { confirmWave } from "@/lib/services/waves";
import { requireUser } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await confirmWave(user, id);
  });
}
