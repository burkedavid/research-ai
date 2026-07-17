import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";

const csvSchema = z.object({
  filename: z.string().min(1).max(100),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).max(10_000),
});

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Table export to CSV (acceptance criterion 6). */
export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = csvSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { filename, headers, rows } = parsed.data;
  const csv = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");

  await audit({
    userId: user.id,
    action: "export",
    entityType: "table",
    detail: { filename, format: "csv", rowCount: rows.length },
    ip: clientIp(req),
  });

  const safeName = filename.replace(/[^\w-]/g, "-");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
