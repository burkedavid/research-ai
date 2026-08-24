import { z } from "zod";
import { handleApi } from "@/lib/api";
import { getRunStatus } from "@/lib/services/retag";
import { requireRole } from "@/lib/session";

const schema = z.object({ runId: z.string().uuid() });

/** Cheap poll for live run progress. */
export async function POST(req: Request) {
  return handleApi(async () => {
    await requireRole("admin");
    const { runId } = schema.parse(await req.json());
    return getRunStatus(runId);
  });
}
