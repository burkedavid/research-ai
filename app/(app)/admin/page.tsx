import { desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLog, clients, themes, users } from "@/db/schema";
import { getUsageSummary } from "@/lib/services/admin";
import { defaultModel, getModelOverrides, selectableModels } from "@/lib/services/model-settings";
import { getThemeCoverage } from "@/lib/services/retag";
import { getSuggestionSettings } from "@/lib/services/suggestions";
import { listThemeProposals } from "@/lib/services/themes";
import { env } from "@/lib/env";
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

  const [userRows, themeRows, auditRows, projectRows, segmentRows, clientRows, usage, modelOverrides, proposals, suggestions, themeCoverage] = await Promise.all([
    db.select().from(users).orderBy(users.email),
    db.select().from(themes).orderBy(themes.name),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(200),
    // projects carry their client + wave counts so the tab is self-explanatory
    db.execute(sql`
      SELECT p.id, p.name, p.lawful_basis, p.retention_months,
             c.id AS client_id, c.name AS client_name,
             count(w.id)::int AS wave_count
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN waves w ON w.project_id = p.id
      GROUP BY p.id, p.name, p.lawful_basis, p.retention_months, c.id, c.name
      ORDER BY c.name, p.name
    `) as unknown as Promise<Record<string, unknown>[]>,
    // usage counts make unmatched segments (0 chunks) obvious at a glance
    db.execute(sql`
      SELECT s.id, s.name, s.description, s.status, s.merged_into,
             count(DISTINCT c.id)::int AS chunk_count,
             count(DISTINCT c.interview_id)::int AS interview_count
      FROM segments s
      LEFT JOIN chunks c ON c.segment_id = s.id
      GROUP BY s.id, s.name, s.description, s.status, s.merged_into
      ORDER BY s.status, s.name
    `) as unknown as Promise<Record<string, unknown>[]>,
    db.select().from(clients).orderBy(clients.name),
    getUsageSummary(),
    getModelOverrides(),
    listThemeProposals(),
    getSuggestionSettings(),
    getThemeCoverage(),
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
      projects={projectRows.map((p) => ({
        id: String(p.id),
        name: String(p.name),
        retentionMonths: (p.retention_months as number | null) ?? null,
        lawfulBasis: (p.lawful_basis as string | null) ?? null,
        clientId: String(p.client_id),
        clientName: String(p.client_name),
        waveCount: Number(p.wave_count ?? 0),
      }))}
      segments={segmentRows.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        description: (s.description as string | null) ?? null,
        status: String(s.status ?? "active"),
        mergedInto: (s.merged_into as string | null) ?? null,
        chunkCount: Number(s.chunk_count ?? 0),
        interviewCount: Number(s.interview_count ?? 0),
      }))}
      clients={clientRows.map((c) => ({ id: c.id, name: c.name, notes: c.notes }))}
      usage={usage}
      models={{
        selectable: selectableModels(),
        query: { current: modelOverrides.query ?? defaultModel("query"), overridden: Boolean(modelOverrides.query), default: defaultModel("query") },
        ingestion: { current: modelOverrides.ingestion ?? defaultModel("ingestion"), overridden: Boolean(modelOverrides.ingestion), default: defaultModel("ingestion") },
      }}
      proposals={proposals.map((p) => ({ id: p.id, name: p.name, occurrences: p.occurrences }))}
      suggestions={suggestions}
      themeCoverage={themeCoverage}
      pipelineMode={env.PIPELINE_MODE}
    />
  );
}
