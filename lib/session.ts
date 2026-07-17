import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ForbiddenError, UnauthorizedError, type SessionUser } from "@/lib/errors";

export { ForbiddenError, UnauthorizedError };
export type { SessionUser };

/**
 * The user object passed into every service function (§B7 SessionUser).
 * Always re-read from the DB — JWT claims are set at sign-in and may be
 * stale; a suspended user or revoked transcript_access takes effect on the
 * next request, not the next login (§A13.1 prompt removal of leavers).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [row] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!row || !row.active) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    transcriptAccess: row.transcriptAccess,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError("Not authenticated");
  return user;
}

const ROLE_RANK = { viewer: 0, researcher: 1, admin: 2 } as const;

export async function requireRole(minimum: "researcher" | "admin"): Promise<SessionUser> {
  const user = await requireUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) {
    throw new ForbiddenError(`Requires ${minimum} role`);
  }
  return user;
}
