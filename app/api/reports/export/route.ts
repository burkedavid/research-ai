import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/api";
import { audit } from "@/lib/audit";
import { buildExportDocx } from "@/lib/export/docx";
import { requireUser } from "@/lib/session";

const citationSchema = z.object({
  n: z.number(),
  chunkId: z.string(),
  documentId: z.string(),
  filename: z.string(),
  sourceType: z.string(),
  evidenceType: z.string(),
  wave: z.string(),
  segmentName: z.string().nullable(),
  interviewRef: z.string().nullable(),
  sectionPath: z.string().nullable(),
  pageRef: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

const exportSchema = z.object({
  title: z.string().min(1).max(300),
  sections: z.array(
    z.object({
      heading: z.string().min(1).max(300),
      text: z.string().max(50_000),
      citations: z.array(citationSchema).default([]),
    }),
  ),
});

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = exportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const buffer = await buildExportDocx(parsed.data);
  await audit({
    userId: user.id,
    action: "export",
    entityType: "report",
    detail: { title: parsed.data.title, format: "docx", sections: parsed.data.sections.length },
    ip: clientIp(req),
  });

  const safeName = parsed.data.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName || "report"}.docx"`,
    },
  });
}
