/**
 * Auth-free shared types and errors. Service functions import from here so
 * they stay importable outside a Next.js request context (tests, scripts,
 * Inngest workers) without dragging in next-auth.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "researcher" | "viewer";
  transcriptAccess: boolean;
}

export class UnauthorizedError extends Error {
  status = 401 as const;
}

export class ForbiddenError extends Error {
  status = 403 as const;
}

export class DuplicateDocumentError extends Error {
  status = 409 as const;
  constructor(public existingId: string) {
    super("An identical file already exists in this wave");
  }
}
