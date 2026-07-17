import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DuplicateDocumentError, ForbiddenError, UnauthorizedError } from "@/lib/errors";

/**
 * Route handlers are thin (§B8): Zod-validate → service call → audit → respond.
 * This wrapper maps service-layer errors to status codes in one place.
 */
export async function handleApi<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await fn();
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message, existingId: err.existingId }, { status: 409 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    }
    // error class only in server logs — messages can contain user input (§B9.5)
    console.error("API_ERROR", err instanceof Error ? err.name : "unknown");
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
