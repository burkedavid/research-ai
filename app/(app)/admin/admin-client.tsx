"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  transcriptAccess: boolean;
  active: boolean;
}

interface ThemeRow {
  id: string;
  name: string;
  definition: string | null;
  status: string;
  mergedInto: string | null;
}

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  retentionMonths: number | null;
  lawfulBasis: string | null;
  clientId: string;
  clientName: string;
  waveCount: number;
}

interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  chunkCount: number;
  interviewCount: number;
}

interface ClientRow {
  id: string;
  name: string;
  notes: string | null;
}

interface Usage {
  byDay: { day: string; model: string; kind: string; calls: number; inputTokens: number; outputTokens: number; estCostGbp: number }[];
  byFeature: { feature: string; kind: string; calls: number; tokens: number; estCostGbp: number }[];
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estCostGbp: number;
    chatGbp: number;
    embeddingGbp: number;
    monthGbp: number;
    last30Gbp: number;
  };
  uncostedModels: string[];
  rates: { model: string; inputUsd: number; outputUsd: number; inputGbp: number; outputGbp: number; verified: boolean; source: string | null }[];
  fx: { rate: number; date: string; live: boolean; note: string };
  retrieval: { searches: number; weakSearches: number };
  ingestion: { documents: number };
}

/** Plain names for the ai_usage feature keys. */
const FEATURE_LABEL: Record<string, string> = {
  ask: "Ask the Archive",
  quotes: "Find Quotes",
  compare: "Compare Periods",
  report: "Reports & briefings",
  trends: "Trends synthesis",
  ingest_suggest: "Ingestion — AI tagging",
  ingest_embed: "Ingestion — embeddings",
  search_query: "Search query embeddings",
  reembed: "Re-embedding",
};

interface ModelChoice {
  current: string;
  overridden: boolean;
  default: string;
}
interface ModelsProp {
  selectable: { id: string; inputUsd: number; outputUsd: number }[];
  query: ModelChoice;
  ingestion: ModelChoice;
}

interface ProposalRow {
  id: string;
  name: string;
  occurrences: number;
}

type Tab = "users" | "segments" | "themes" | "projects" | "audit" | "usage" | "retention";

/* ---------- audit log presentation ---------- */

const ACTION_LABEL: Record<string, string> = {
  login: "Signed in",
  upload: "Uploaded",
  approve: "Approved",
  reject: "Rejected",
  search: "Searched",
  source_view: "Viewed source",
  export: "Exported",
  permission_change: "Permissions",
  delete: "Deleted",
  theme_edit: "Theme",
  segment_edit: "Segment",
  client_edit: "Client",
  project_edit: "Project",
  wave_edit: "Wave",
};

const AUDIT_STYLE: Record<string, string> = {
  login: "bg-slate-100 text-slate-700",
  upload: "bg-sr-blue/15 text-sky-800",
  approve: "bg-green-100 text-green-800",
  reject: "bg-amber-100 text-amber-900",
  search: "bg-sr-cyan/15 text-teal-800",
  source_view: "bg-slate-100 text-slate-700",
  export: "bg-sr-purple/15 text-purple-800",
  permission_change: "bg-amber-100 text-amber-900",
  delete: "bg-red-100 text-red-800",
  theme_edit: "bg-sr-green/15 text-green-800",
  segment_edit: "bg-sr-green/15 text-green-800",
  client_edit: "bg-sr-orange/15 text-orange-800",
  project_edit: "bg-sr-orange/15 text-orange-800",
  wave_edit: "bg-sr-yellow/15 text-amber-800",
};

/** Filter chips: group the raw actions into things an admin actually looks for. */
const AUDIT_GROUPS = [
  { key: "access", label: "Access & security", actions: ["login", "permission_change"] },
  { key: "content", label: "Content", actions: ["upload", "approve", "reject", "delete"] },
  { key: "usage", label: "Research activity", actions: ["search", "source_view", "export"] },
  { key: "config", label: "Configuration", actions: ["theme_edit", "segment_edit", "client_edit", "project_edit", "wave_edit"] },
] as const;

const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth() + 1]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function relativeTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d} day${d === 1 ? "" : "s"} ago` : `${Math.floor(d / 30)} mo ago`;
}

/**
 * Turn a raw audit row into one plain-English sentence. The detail JSON is
 * deliberately never dumped: it contains one-way query hashes and internal ids
 * that mean nothing to a reader and make the log unusable as a record.
 */
function describeAudit(a: AuditRow): string {
  const d = (a.detail ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  const file = str("filename");
  const feature = str("feature");
  const op = str("op");
  const entity = a.entityType ?? "record";

  switch (a.action) {
    case "login":
      return "Signed in to the hub";
    case "upload":
      return `${file ?? "A document"}${d.version && Number(d.version) > 1 ? ` (version ${d.version})` : ""}${
        str("sourceType") ? ` — ${str("sourceType")!.replace(/_/g, " ")}` : ""
      }`;
    case "approve":
      return `${file ?? "A document"} approved and indexed`;
    case "reject":
      return `${file ?? "A document"} rejected at review`;
    case "delete":
      return op === "delete_empty_wave" ? "Removed an empty wave" : `${file ?? `A ${entity}`} permanently deleted`;
    case "source_view":
      return `Opened ${file ?? "a source document"}`;
    case "search": {
      const where =
        feature === "ask" ? "Ask the Archive" : feature === "quotes" ? "Find Quotes" : feature === "compare" ? "Compare Periods" : feature === "report" ? "a report" : feature === "word_frequency" ? "word frequency" : "the archive";
      return `Ran a search in ${where}`;
    }
    case "export":
      return op === "share_created"
        ? "Created a read-only share link"
        : op === "share_revoked"
          ? "Revoked a share link"
          : `Exported ${str("what") ?? "an output"}${str("format") ? ` as ${str("format")}` : ""}`;
    case "permission_change": {
      if (op === "create") return `Created user account (${str("role") ?? "user"})`;
      if (op === "retention") return `Set retention to ${d.retentionMonths ?? "no limit"} month(s)`;
      const bits = [
        str("role") ? `role → ${str("role")}` : null,
        typeof d.transcriptAccess === "boolean" ? `transcript access ${d.transcriptAccess ? "granted" : "removed"}` : null,
        typeof d.active === "boolean" ? (d.active ? "reactivated" : "deactivated") : null,
      ].filter(Boolean);
      return bits.length ? `Account updated: ${bits.join(", ")}` : "Account permissions changed";
    }
    case "theme_edit":
    case "segment_edit":
    case "client_edit":
    case "project_edit":
    case "wave_edit": {
      const noun = a.action.replace("_edit", "");
      const name = str("name");
      if (op === "create") return `Created ${noun}${name ? ` “${name}”` : ""}`;
      if (op === "merge") return `Merged a ${noun} into another${d.chunksMoved ? ` (${d.chunksMoved} passages moved)` : ""}`;
      if (op === "update") return `Updated ${noun}${name ? ` “${name}”` : ""}`;
      return `Changed a ${noun}`;
    }
    default:
      return op ? `${op.replace(/_/g, " ")}` : "—";
  }
}

export function AdminClient({
  currentUserId,
  users,
  themes,
  auditRows,
  projects,
  segments,
  clients,
  usage,
  models,
  proposals,
}: {
  currentUserId: string;
  users: UserRow[];
  themes: ThemeRow[];
  auditRows: AuditRow[];
  projects: ProjectRow[];
  segments: SegmentRow[];
  clients: ClientRow[];
  usage: Usage;
  models: ModelsProp;
  proposals: ProposalRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<"all" | (typeof AUDIT_GROUPS)[number]["key"]>("all");

  /** Resolve the actor id to a name — a bare UUID tells a reader nothing. */
  const userLabel = (id: string | null) => {
    if (!id) return "System";
    const u = users.find((x) => x.id === id);
    return u ? u.name : "Removed user";
  };

  const visibleAudit =
    auditFilter === "all"
      ? auditRows
      : auditRows.filter((a) =>
          (AUDIT_GROUPS.find((g) => g.key === auditFilter)?.actions as readonly string[] | undefined)?.includes(a.action),
        );

  async function call(url: string, method: string, body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Request failed");
      return false;
    }
    router.refresh();
    return true;
  }

  const activeThemes = themes.filter((t) => t.status === "active");

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader icon="admin" title="Administration" subtitle="Users, taxonomy, audit, usage and retention." />
      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(["users", "segments", "themes", "projects", "audit", "usage", "retention"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px px-4 py-2 text-sm transition-colors ${tab === t ? "border-b-2 border-brand-800 font-medium text-brand-900" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "audit" ? "Audit log" : t === "usage" ? "Usage & cost" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tab === "users" && (
        <div className="mt-4">
          <Card>
            <CardContent>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const ok = await call("/api/admin/users", "POST", {
                    email: form.get("email"),
                    name: form.get("name"),
                    role: form.get("role"),
                    transcriptAccess: form.get("transcriptAccess") === "on",
                  });
                  if (ok) (e.target as HTMLFormElement).reset();
                }}
              >
                <Input name="email" type="email" required placeholder="email" className="w-auto" />
                <Input name="name" required placeholder="name" className="w-auto" />
                <select name="role" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                  <option value="viewer">viewer</option>
                  <option value="researcher">researcher</option>
                  <option value="admin">admin</option>
                </select>
                <label className="flex items-center gap-1 text-sm text-slate-600">
                  <input name="transcriptAccess" type="checkbox" /> transcript access
                </label>
                <Button type="submit">Add user</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Transcripts</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="font-medium text-slate-900">{u.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                    </TableCell>
                    <TableCell>
                      <select
                        value={u.role}
                        disabled={u.id === currentUserId}
                        onChange={(e) => call("/api/admin/users", "PATCH", { userId: u.id, role: e.target.value })}
                        className="h-7 rounded-lg border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        <option value="viewer">viewer</option>
                        <option value="researcher">researcher</option>
                        <option value="admin">admin</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={u.transcriptAccess}
                        onChange={(e) => call("/api/admin/users", "PATCH", { userId: u.id, transcriptAccess: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        disabled={u.id === currentUserId}
                        onClick={() => call("/api/admin/users", "PATCH", { userId: u.id, active: !u.active })}
                        className={`rounded-full px-2 py-0.5 text-xs ${u.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} disabled:opacity-40`}
                      >
                        {u.active ? "active — click to suspend" : "suspended — click to restore"}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {tab === "themes" && (
        <div className="mt-4">
          {proposals.length > 0 && (
            <Card className="mb-4 overflow-hidden pt-0">
              <div className="h-1 w-full bg-sr-green" />
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-brand-900">
                  Suggested new themes{" "}
                  <span className="font-normal text-muted-foreground">— proposed by the ingest AI, outside the taxonomy</span>
                </p>
                <div className="mt-3 space-y-2">
                  {proposals.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-brand-50/40 px-3 py-2 text-sm">
                      <span className="font-medium text-brand-900">{p.name}</span>
                      <span className="text-xs text-muted-foreground">proposed {p.occurrences}×</span>
                      <div className="ml-auto flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => call(`/api/theme-proposals/${p.id}`, "POST", { action: "promote" })}
                        >
                          Add to taxonomy
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => call(`/api/theme-proposals/${p.id}`, "POST", { action: "dismiss" })}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const ok = await call("/api/themes", "POST", { name: form.get("name"), definition: form.get("definition") || undefined });
                  if (ok) (e.target as HTMLFormElement).reset();
                }}
              >
                <Input name="name" required placeholder="new theme name" className="w-auto" />
                <Input name="definition" placeholder="definition (recommended)" className="w-72" />
                <Button type="submit">Add theme</Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-2">
            {themes.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex flex-wrap items-center gap-3 text-sm">
                  <span className={t.status === "merged" ? "text-muted-foreground line-through" : "font-medium text-slate-900"}>{t.name}</span>
                  {t.status === "merged" && (
                    <span className="text-xs text-muted-foreground">
                      merged into {themes.find((x) => x.id === t.mergedInto)?.name ?? "?"} (history preserved)
                    </span>
                  )}
                  {t.status === "active" && (
                    <>
                      <Input
                        defaultValue={t.definition ?? ""}
                        placeholder="definition…"
                        onBlur={(e) => {
                          if (e.target.value !== (t.definition ?? "")) {
                            call(`/api/themes/${t.id}`, "PATCH", { definition: e.target.value });
                          }
                        }}
                        className="min-w-64 flex-1 text-xs"
                      />
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value && confirm(`Merge "${t.name}" into "${activeThemes.find((x) => x.id === e.target.value)?.name}"? Historic tagging stays traceable.`)) {
                            call("/api/themes/merge", "POST", { sourceId: t.id, targetId: e.target.value });
                          }
                          e.target.value = "";
                        }}
                        className="h-8 rounded-lg border border-input bg-transparent px-1.5 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">merge into…</option>
                        {activeThemes
                          .filter((x) => x.id !== t.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "segments" && (
        <div className="mt-4">
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Consumer segments</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reports attribute verbatim inline as <em>(Segment, Region)</em>. A segment showing{" "}
                <strong>0 passages</strong> means report attributions aren&apos;t matching that name — check the spelling
                used in the reports, or merge it into the segment it should be.
              </p>
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const ok = await call("/api/admin/segments", "POST", {
                    name: form.get("name"),
                    description: form.get("description") || undefined,
                  });
                  if (ok) (e.target as HTMLFormElement).reset();
                }}
              >
                <Input name="name" required placeholder="segment name" className="w-auto" />
                <Input name="description" placeholder="description (optional)" className="w-auto" />
                <Button type="submit">Add segment</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-4 py-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Passages</TableHead>
                  <TableHead>Interviews</TableHead>
                  <TableHead>Merge into…</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <input
                        defaultValue={s.name}
                        onBlur={(e) => e.target.value !== s.name && call("/api/admin/segments", "PATCH", { segmentId: s.id, name: e.target.value })}
                        className="w-48 rounded border border-transparent px-1 py-0.5 text-sm font-medium text-slate-900 hover:border-input focus:border-input focus:outline-none"
                      />
                      <input
                        defaultValue={s.description ?? ""}
                        placeholder="add a description"
                        onBlur={(e) =>
                          e.target.value !== (s.description ?? "") &&
                          call("/api/admin/segments", "PATCH", { segmentId: s.id, description: e.target.value || null })
                        }
                        className="mt-0.5 block w-72 rounded border border-transparent px-1 py-0.5 text-xs text-muted-foreground hover:border-input focus:border-input focus:outline-none"
                      />
                    </TableCell>
                    <TableCell>
                      {s.chunkCount === 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">0 — unmatched</span>
                      ) : (
                        <span className="text-sm tabular-nums text-slate-700">{s.chunkCount}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{s.interviewCount}</TableCell>
                    <TableCell>
                      <select
                        value=""
                        onChange={(e) => {
                          const target = segments.find((x) => x.id === e.target.value);
                          if (
                            target &&
                            confirm(`Merge "${s.name}" into "${target.name}"? ${s.chunkCount} passage(s) will be re-attributed and "${s.name}" removed.`)
                          ) {
                            call("/api/admin/segments", "PUT", { sourceId: s.id, targetId: target.id });
                          }
                          e.target.value = "";
                        }}
                        className="h-7 rounded-lg border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">—</option>
                        {segments
                          .filter((x) => x.id !== s.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {tab === "projects" && (
        <div className="mt-4">
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Clients</p>
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const ok = await call("/api/admin/clients", "POST", {
                    name: form.get("name"),
                    notes: form.get("notes") || undefined,
                  });
                  if (ok) (e.target as HTMLFormElement).reset();
                }}
              >
                <Input name="name" required placeholder="client name" className="w-auto" />
                <Input name="notes" placeholder="notes (optional)" className="w-auto" />
                <Button type="submit">Add client</Button>
              </form>
              <ul className="mt-3 space-y-1 text-sm">
                {clients.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <input
                      defaultValue={c.name}
                      onBlur={(e) => e.target.value !== c.name && call("/api/admin/clients", "PATCH", { clientId: c.id, name: e.target.value })}
                      className="rounded border border-transparent px-1 py-0.5 font-medium text-slate-900 hover:border-input focus:border-input focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground">
                      {projects.filter((p) => p.clientId === c.id).length} project(s)
                    </span>
                  </li>
                ))}
                {clients.length === 0 && <li className="text-muted-foreground">No clients yet.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Projects</p>
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const months = form.get("retentionMonths");
                  const ok = await call("/api/admin/projects", "POST", {
                    clientId: form.get("clientId"),
                    name: form.get("name"),
                    lawfulBasis: form.get("lawfulBasis") || undefined,
                    retentionMonths: months ? Number(months) : null,
                  });
                  if (ok) (e.target as HTMLFormElement).reset();
                }}
              >
                <select
                  name="clientId"
                  required
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input name="name" required placeholder="project name" className="w-auto" />
                <Input name="lawfulBasis" placeholder="lawful basis (optional)" className="w-auto" />
                <Input name="retentionMonths" type="number" min={1} max={600} placeholder="retention months" className="w-auto" />
                <Button type="submit" disabled={clients.length === 0}>
                  Add project
                </Button>
              </form>
              {clients.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">Add a client first — every project belongs to one.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 py-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Waves</TableHead>
                  <TableHead>Lawful basis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <input
                        defaultValue={p.name}
                        onBlur={(e) => e.target.value !== p.name && call("/api/admin/projects", "PATCH", { projectId: p.id, name: e.target.value })}
                        className="w-48 rounded border border-transparent px-1 py-0.5 text-sm font-medium text-slate-900 hover:border-input focus:border-input focus:outline-none"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.clientName}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">{p.waveCount}</TableCell>
                    <TableCell>
                      <input
                        defaultValue={p.lawfulBasis ?? ""}
                        placeholder="—"
                        onBlur={(e) =>
                          e.target.value !== (p.lawfulBasis ?? "") &&
                          call("/api/admin/projects", "PATCH", { projectId: p.id, lawfulBasis: e.target.value || null })
                        }
                        className="w-56 rounded border border-transparent px-1 py-0.5 text-xs text-muted-foreground hover:border-input focus:border-input focus:outline-none"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {tab === "audit" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(["all", ...AUDIT_GROUPS.map((g) => g.key)] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAuditFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  auditFilter === k
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-900"
                    : "border-border text-muted-foreground hover:border-brand-600 hover:text-foreground"
                }`}
              >
                {k === "all" ? "All activity" : AUDIT_GROUPS.find((g) => g.key === k)!.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">{visibleAudit.length} of {auditRows.length} events</span>
          </div>

          <Card className="py-0">
            <Table className="min-w-[680px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead className="w-44">Who</TableHead>
                  <TableHead>What happened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAudit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No activity of this kind recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {visibleAudit.map((a) => {
                  const style = AUDIT_STYLE[a.action] ?? "bg-slate-100 text-slate-700";
                  return (
                    <TableRow key={a.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <span className="block">{formatWhen(a.createdAt)}</span>
                        <span className="block text-xs text-slate-400">{relativeTime(a.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-slate-700">{userLabel(a.userId)}</TableCell>
                      <TableCell>
                        <span className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>
                          {ACTION_LABEL[a.action] ?? a.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-800">{describeAudit(a)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">
            Search terms are never stored — only a one-way hash, so the log proves a search happened without recording
            what was asked.
          </p>
        </div>
      )}

      {tab === "usage" && (
        <div className="mt-4 space-y-4">
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Models in use</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Change the model a job uses and the next request picks it up — no redeploy. Prices are per 1M tokens, so
                you can trial a cheaper model on real work and judge quality against the saving yourself.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {(["query", "ingestion"] as const).map((job) => (
                  <label key={job} className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-foreground">
                      {job === "query" ? "Answers, comparisons & reports" : "Ingestion tagging"}
                    </span>
                    <Select
                      value={models[job].current}
                      onChange={(e) =>
                        call("/api/admin/models", "PATCH", {
                          job,
                          model: e.target.value === models[job].default ? null : e.target.value,
                        })
                      }
                    >
                      {models.selectable.length === 0 && <option value="">provider has no selectable models</option>}
                      {models.selectable.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — ${m.inputUsd}/${m.outputUsd} per 1M
                        </option>
                      ))}
                    </Select>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {models[job].overridden ? `overridden — default is ${models[job].default}` : "using the default"}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Total AI spend</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">£{usage.totals.estCostGbp.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{usage.totals.calls.toLocaleString()} calls, all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">This month</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">£{usage.totals.monthGbp.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">£{usage.totals.last30Gbp.toFixed(2)} last 30 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Generation (chat)</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">£{usage.totals.chatGbp.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {(usage.totals.inputTokens + usage.totals.outputTokens).toLocaleString()} tokens total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Embeddings</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">£{usage.totals.embeddingGbp.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">ingestion + every search query</p>
              </CardContent>
            </Card>
          </div>

          {usage.uncostedModels.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                No price is configured for {usage.uncostedModels.join(", ")} — their spend is missing from the totals
                above. Add a rate in lib/config.ts so the budget figure is complete.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Spend by activity</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Where the money actually goes.</p>
              <Table className="mt-3 min-w-[520px] text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Est. £</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.byFeature.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No AI activity recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {usage.byFeature.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-slate-900">{FEATURE_LABEL[f.feature] ?? f.feature}</TableCell>
                      <TableCell className="text-muted-foreground">{f.kind}</TableCell>
                      <TableCell>{f.calls.toLocaleString()}</TableCell>
                      <TableCell>{f.tokens.toLocaleString()}</TableCell>
                      <TableCell>£{f.estCostGbp.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Daily breakdown by model</p>
              <Table className="mt-3 min-w-[620px] text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Output</TableHead>
                    <TableHead>Est. £</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.byDay.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        No AI activity yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {usage.byDay.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>{d.day}</TableCell>
                      <TableCell>{d.model}</TableCell>
                      <TableCell className="text-muted-foreground">{d.kind}</TableCell>
                      <TableCell>{d.calls}</TableCell>
                      <TableCell>{d.inputTokens.toLocaleString()}</TableCell>
                      <TableCell>{d.outputTokens.toLocaleString()}</TableCell>
                      <TableCell>£{d.estCostGbp.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-brand-900">Rate card</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Token counts above are exact, taken from each provider response. Providers publish and bill in USD, so
                prices are held in USD and converted to £ at today's rate — {usage.fx.note}.
              </p>
              <Table className="mt-3 min-w-[420px] text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Input $/1M</TableHead>
                    <TableHead>Output $/1M</TableHead>
                    <TableHead>Input £/1M</TableHead>
                    <TableHead>Output £/1M</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.rates.map((r) => (
                    <TableRow key={r.model}>
                      <TableCell className="font-medium text-slate-900">{r.model}</TableCell>
                      <TableCell>${r.inputUsd}</TableCell>
                      <TableCell>${r.outputUsd}</TableCell>
                      <TableCell>£{r.inputGbp.toFixed(3)}</TableCell>
                      <TableCell>£{r.outputGbp.toFixed(3)}</TableCell>
                      <TableCell className="text-xs">
                        {r.verified ? (
                          <span className="text-green-700">{r.source ?? "published price"}</span>
                        ) : (
                          <span className="text-amber-700">estimate — not checked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <span>
                <span className="text-muted-foreground">Searches: </span>
                <span className="font-medium text-slate-900">{usage.retrieval.searches}</span>
                <span className="ml-1 text-xs text-amber-700">({usage.retrieval.weakSearches} weak evidence)</span>
              </span>
              <span>
                <span className="text-muted-foreground">Indexed documents: </span>
                <span className="font-medium text-slate-900">{usage.ingestion.documents}</span>
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "retention" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Documents older than a project&apos;s retention period are permanently deleted (file, chunks, full-text index and
            embeddings) by a nightly job. Deletions are audited.
          </p>
          {projects.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-900">{p.name}</span>
                <Input
                  type="number"
                  min={1}
                  defaultValue={p.retentionMonths ?? ""}
                  placeholder="no limit"
                  onBlur={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    if (value !== p.retentionMonths) {
                      call("/api/admin/projects", "PATCH", { projectId: p.id, retentionMonths: value });
                    }
                  }}
                  className="w-28"
                />
                <span className="text-xs text-muted-foreground">months (blank = keep indefinitely)</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
