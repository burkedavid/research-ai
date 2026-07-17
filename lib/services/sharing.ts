import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savedOutputs } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/errors";

/**
 * Shareable read-only links for saved outputs (F3). A share exposes only the
 * already-generated output content (answers, comparisons, report drafts, quote
 * lists) — never raw retrieval or transcript access — so it is safe to hand to
 * a stakeholder who will not log in. Creating and revoking are audited.
 */
export async function createShareLink(user: SessionUser, savedOutputId: string, ip?: string | null): Promise<string> {
  const [row] = await db.select().from(savedOutputs).where(eq(savedOutputs.id, savedOutputId));
  if (!row || row.userId !== user.id) throw new Error("Saved output not found");

  const token = row.shareToken ?? randomBytes(18).toString("base64url");
  if (!row.shareToken) {
    await db
      .update(savedOutputs)
      .set({ shareToken: token, sharedAt: new Date() })
      .where(eq(savedOutputs.id, savedOutputId));
    await audit({
      userId: user.id,
      action: "export",
      entityType: "saved_output",
      entityId: savedOutputId,
      detail: { op: "share_created", kind: row.kind },
      ip,
    });
  }
  return token;
}

export async function revokeShareLink(user: SessionUser, savedOutputId: string, ip?: string | null): Promise<void> {
  const [row] = await db.select().from(savedOutputs).where(eq(savedOutputs.id, savedOutputId));
  if (!row || row.userId !== user.id) throw new Error("Saved output not found");
  await db.update(savedOutputs).set({ shareToken: null, sharedAt: null }).where(eq(savedOutputs.id, savedOutputId));
  await audit({
    userId: user.id,
    action: "export",
    entityType: "saved_output",
    entityId: savedOutputId,
    detail: { op: "share_revoked" },
    ip,
  });
}

/** Public read — no auth. Returns only presentational fields. */
export async function getSharedOutput(token: string) {
  if (!token) return null;
  const [row] = await db.select().from(savedOutputs).where(eq(savedOutputs.shareToken, token));
  if (!row) return null;
  return { kind: row.kind, title: row.title, content: row.content, sharedAt: row.sharedAt };
}
