import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { registerUpload } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";

const registerSchema = z
  .object({
    waveId: z.string().uuid().optional(),
    // item 2: derive the wave from the filename date under this project
    autoDateProjectId: z.string().uuid().optional(),
    blobUrl: z.string().min(1),
    blobPathname: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    sourceType: z.enum([
      "report",
      "transcript",
      "crib_sheet",
      "moderator_notes",
      "discussion_guide",
      "debrief_deck",
      "coding_frame",
      "tabular",
      "other",
    ]),
  })
  .refine((b) => b.waveId || b.autoDateProjectId, {
    message: "Either waveId or autoDateProjectId is required",
  });

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = registerSchema.parse(await req.json());
    return registerUpload({ user, ...body, ip: clientIp(req) });
  });
}
