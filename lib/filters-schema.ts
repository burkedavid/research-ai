import { z } from "zod";

/** Shared retrieval filter validation for /api/ask, /api/quotes, /api/compare. */
export const filtersSchema = z
  .object({
    waveIds: z.array(z.string().uuid()).optional(),
    dateRange: z
      .object({
        fromYear: z.number().int(),
        fromMonth: z.number().int().min(1).max(12),
        toYear: z.number().int(),
        toMonth: z.number().int().min(1).max(12),
      })
      .optional(),
    segmentIds: z.array(z.string().uuid()).optional(),
    themeIds: z.array(z.string().uuid()).optional(),
    sourceTypes: z.array(z.string()).optional(),
    evidenceTypes: z.array(z.string()).optional(),
    speakerRole: z.enum(["moderator", "consumer", "mixed", "n/a"]).optional(),
  })
  .optional();
