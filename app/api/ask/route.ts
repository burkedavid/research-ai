import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/api";
import { filtersSchema } from "@/lib/filters-schema";
import { runAsk } from "@/lib/services/ask";
import { requireUser } from "@/lib/session";

const askSchema = z.object({
  question: z.string().min(3).max(2000),
  filters: filtersSchema,
  conversationId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = askSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  return runAsk({ user, ...parsed.data, ip: clientIp(req) });
}
