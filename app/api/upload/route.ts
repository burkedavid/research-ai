import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { handleApi } from "@/lib/api";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import { getStorage } from "@/lib/storage";

/**
 * Upload endpoint (§B4 constraint 1). Production: issues Vercel Blob
 * client-upload tokens so files go browser → Blob directly, never through a
 * function body. Local dev: accepts multipart straight onto the filesystem
 * driver (no serverless body limit locally).
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (env.STORAGE_DRIVER === "vercel-blob") {
    // token issuance requires an authenticated researcher (§B9)
    await requireRole("researcher").catch(() => {
      throw new Error("Not authorised to upload");
    });
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "application/pdf",
          "text/plain",
          "text/vtt",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 100 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // document row creation happens via POST /api/documents from the client
      },
    });
    return NextResponse.json(result);
  }

  return handleApi(async () => {
    await requireRole("researcher");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    const pathname = `uploads/${randomUUID()}/${file.name}`;
    const stored = await getStorage().put(
      pathname,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
    return stored;
  });
}
