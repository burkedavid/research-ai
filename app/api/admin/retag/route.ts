import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { dispatchRetagRun } from "@/lib/ingestion/dispatch";
import { cancelRun, getRunStatus, getThemeCoverage, planThemeRun } from "@/lib/services/retag";
import { requireRole } from "@/lib/session";

const planSchema = z.object({ themeId: z.string().uuid() });
const startSchema = z.object({ runId: z.string().uuid() });

/** Coverage for every theme, plus any run in flight. */
export async function GET() {
  return handleApi(async () => {
    await requireRole("admin");
    return getThemeCoverage();
  });
}

/**
 * Plan a run: select and price the candidates. Deliberately separate from
 * starting one, so the £ estimate is seen before anything is spent.
 */
export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const { themeId } = planSchema.parse(await req.json());
    return planThemeRun(admin, themeId, clientIp(req));
  });
}

/** Start a planned run. This is the click that spends money. */
export async function PUT(req: Request) {
  return handleApi(async () => {
    await requireRole("admin");
    const { runId } = startSchema.parse(await req.json());
    await dispatchRetagRun(runId);
    return getRunStatus(runId);
  });
}

export async function DELETE(req: Request) {
  return handleApi(async () => {
    const admin = await requireRole("admin");
    const { runId } = startSchema.parse(await req.json());
    await cancelRun(admin, runId);
  });
}
