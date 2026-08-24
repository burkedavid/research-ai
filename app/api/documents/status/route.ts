import { z } from "zod";
import { handleApi } from "@/lib/api";
import { getDocumentStatuses } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(50) });

/** Polled by the upload dialogs while ingestion runs. Deliberately cheap:
 *  status, error and warning count only, no document bodies. */
export async function POST(req: Request) {
  return handleApi(async () => {
    await requireUser();
    const { ids } = schema.parse(await req.json());
    return getDocumentStatuses(ids);
  });
}
