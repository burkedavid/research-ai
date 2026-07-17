import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promptTemplates } from "@/db/schema";
import { handleApi } from "@/lib/api";
import { requireUser } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  defaultFilters: z.record(z.string(), z.unknown()).optional(),
  shared: z.boolean().optional(),
});

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    return db
      .select()
      .from(promptTemplates)
      .where(or(eq(promptTemplates.userId, user.id), eq(promptTemplates.shared, true)))
      .orderBy(promptTemplates.name);
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    const [row] = await db
      .insert(promptTemplates)
      .values({ userId: user.id, ...body })
      .returning();
    return row;
  });
}
