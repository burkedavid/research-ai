import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { filtersSchema } from "@/lib/filters-schema";
import { findQuotes } from "@/lib/services/quotes";
import { requireUser } from "@/lib/session";

const quotesSchema = z.object({
  query: z.string().min(2).max(500),
  filters: filtersSchema,
  collapseDuplicates: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = quotesSchema.parse(await req.json());
    return findQuotes({ user, ...body, ip: clientIp(req) });
  });
}
