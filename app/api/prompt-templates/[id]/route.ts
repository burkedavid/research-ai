import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { promptTemplates } from "@/db/schema";
import { handleApi } from "@/lib/api";
import { ForbiddenError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(5000).optional(),
  shared: z.boolean().optional(),
});

/** Only the template's owner may rename, re-share or delete it — a shared
 *  template is visible to everyone but still belongs to whoever saved it. */
async function requireOwned(templateId: string, userId: string) {
  const [row] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, templateId));
  if (!row) throw new Error("Template not found");
  if (row.userId !== userId) throw new ForbiddenError("You can only change templates you saved");
  return row;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireOwned(id, user.id);
    const body = patchSchema.parse(await req.json());
    if (Object.keys(body).length === 0) return;
    await db.update(promptTemplates).set(body).where(eq(promptTemplates.id, id));
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireOwned(id, user.id);
    await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
  });
}
