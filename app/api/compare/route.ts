import { z } from "zod";
import { clientIp, handleApi } from "@/lib/api";
import { filtersSchema } from "@/lib/filters-schema";
import { comparePeriods } from "@/lib/services/compare";
import { requireUser } from "@/lib/session";

const compareSchema = z.object({
  question: z.string().min(3).max(2000),
  labelA: z.string().min(1).max(100),
  filtersA: filtersSchema,
  labelB: z.string().min(1).max(100),
  filtersB: filtersSchema,
});

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = compareSchema.parse(await req.json());
    return comparePeriods({
      user,
      question: body.question,
      labelA: body.labelA,
      filtersA: body.filtersA ?? {},
      labelB: body.labelB,
      filtersB: body.filtersB ?? {},
      ip: clientIp(req),
    });
  });
}
