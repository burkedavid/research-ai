import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "login"
  | "upload"
  | "approve"
  | "reject"
  | "search"
  | "source_view"
  | "export"
  | "permission_change"
  | "delete"
  | "theme_edit";

/**
 * The single write path to audit_log (§B5). Insert-only by construction:
 * no update/delete helper exists anywhere in the codebase.
 * Never throws — an audit failure must not take down the action itself,
 * but it is logged loudly for the hardening sweep.
 */
export async function audit(params: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detail: params.detail,
      ip: params.ip ?? null,
    });
  } catch (err) {
    console.error("AUDIT_WRITE_FAILED", { action: params.action, err: String(err) });
  }
}
