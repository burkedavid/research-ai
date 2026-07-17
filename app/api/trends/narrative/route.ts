import { NextResponse } from "next/server";
import { clientIp, handleApi } from "@/lib/api";
import { synthesiseTrends } from "@/lib/services/trends";
import { requireUser } from "@/lib/session";

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const result = await synthesiseTrends(user, clientIp(req));
    if (!result) return NextResponse.json({ error: "At least two waves are needed for a trend narrative" }, { status: 400 });
    return result;
  });
}
