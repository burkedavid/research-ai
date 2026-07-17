import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { clientIp } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { getStorage } from "@/lib/storage";

/**
 * Original file access (§B9.4): originals are private and only ever served
 * through this authorised handler. Raw transcript files require
 * transcript_access (§B9.2); every access is audited as source_view.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc || doc.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.sourceType === "transcript" && !user.transcriptAccess) {
    return NextResponse.json({ error: "Transcript access required" }, { status: 403 });
  }

  const buffer = await getStorage().get({ url: doc.blobUrl, pathname: doc.blobPathname });
  await audit({
    userId: user.id,
    action: "source_view",
    entityType: "document",
    entityId: doc.id,
    detail: { filename: doc.filename },
    ip: clientIp(req),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
