import { z } from "zod";
import { handleApi } from "@/lib/api";
import { updateChunkReview } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

const updateSchema = z.object({
  content: z.string().min(1).optional(),
  speakerRole: z.enum(["moderator", "consumer", "mixed", "n/a"]).optional(),
  evidenceType: z.enum(["direct_quote", "researcher_summary", "guide", "context"]).optional(),
  segmentId: z.string().uuid().nullable().optional(),
  interviewId: z.string().uuid().nullable().optional(),
  themeIds: z.array(z.string().uuid()).optional(),
  clearPiiSuggestions: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const updates = updateSchema.parse(await req.json());
    await updateChunkReview(user, id, updates);
  });
}
