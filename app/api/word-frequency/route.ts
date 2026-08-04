import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { filtersSchema } from "@/lib/filters-schema";
import { analyzeWordFrequency } from "@/lib/services/word-frequency";
import { requireUser } from "@/lib/session";

const schema = z.object({
  topic: z.string().max(200).optional(),
  filters: filtersSchema,
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    return analyzeWordFrequency({ user, topic: body.topic, filters: body.filters, ip: clientIp(req) });
  });
}
