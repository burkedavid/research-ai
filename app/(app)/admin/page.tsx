import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLog, projects, themes, users } from "@/db/schema";
import { getUsageSummary } from "@/lib/services/admin";
import { listThemeProposals } from "@/lib/services/themes";
import { getSessionUser } from "@/lib/session";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Administration requires the admin role.</p>
      </div>
    );
  }

  const [userRows, themeRows, auditRows, projectRows, usage, proposals] = await Promise.all([
    db.select().from(users).orderBy(users.email),
    db.select().from(themes).orderBy(themes.name),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(200),
    db.select().from(projects),
    getUsageSummary(),
    listThemeProposals(),
  ]);

  return (
    <AdminClient
      currentUserId={user.id}
      users={userRows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        transcriptAccess: u.transcriptAccess,
        active: u.active,
      }))}
      themes={themeRows.map((t) => ({
        id: t.id,
        name: t.name,
        definition: t.definition,
        status: t.status,
        mergedInto: t.mergedInto,
      }))}
      auditRows={auditRows.map((a) => ({
        id: a.id,
        userId: a.userId,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        detail: a.detail as Record<string, unknown> | null,
        createdAt: a.createdAt.toISOString(),
      }))}
      projects={projectRows.map((p) => ({ id: p.id, name: p.name, retentionMonths: p.retentionMonths }))}
      usage={usage}
      proposals={proposals.map((p) => ({ id: p.id, name: p.name, occurrences: p.occurrences }))}
    />
  );
}
