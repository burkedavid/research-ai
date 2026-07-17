import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedOutputs } from "@/db/schema";
import { handleApi } from "@/lib/api";
import { requireUser } from "@/lib/session";

const createSchema = z.object({
  kind: z.enum(["answer", "quote_list", "comparison", "report_draft"]),
  title: z.string().min(1).max(200),
  content: z.record(z.string(), z.unknown()),
});

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return db
      .select()
      .from(savedOutputs)
      .where(eq(savedOutputs.userId, user.id))
      .orderBy(desc(savedOutputs.createdAt));
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    const [row] = await db
      .insert(savedOutputs)
      .values({ userId: user.id, ...body })
      .returning();
    return row;
  });
}
