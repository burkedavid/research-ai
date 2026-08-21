"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  byDay: { day: string; model: string; messages: number; inputTokens: number; outputTokens: number; estCostGbp: number }[];
  retrieval: { searches: number; weakSearches: number };
  ingestion: { documents: number; inputTokens: number; outputTokens: number };
}

interface ProposalRow {
  id: string;
  name: string;
  occurrences: number;
}

type Tab = "users" | "segments" | "themes" | "projects" | "audit" | "usage" | "retention";

export function AdminClient({
  currentUserId,
  users,
  themes,
  auditRows,
  projects,
  segments,
  clients,
  usage,
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
  proposals: ProposalRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState<string | null>(null);

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
        <Card className="mt-4">
          <Table className="min-w-[560px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.map((a) => (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-muted-foreground">{a.createdAt.replace("T", " ").slice(0, 19)}</TableCell>
                  <TableCell className="font-medium text-slate-900">{a.action}</TableCell>
                  <TableCell className="text-slate-600">
                    {a.entityType}
                    {a.entityId ? ` ${a.entityId.slice(0, 8)}…` : ""}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{a.detail ? JSON.stringify(a.detail) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "usage" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Searches</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">{usage.retrieval.searches}</p>
                <p className="text-xs text-amber-700">{usage.retrieval.weakSearches} returned weak evidence</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Ingested documents (LLM-assisted)</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">{usage.ingestion.documents}</p>
                <p className="text-xs text-muted-foreground">
                  {usage.ingestion.inputTokens + usage.ingestion.outputTokens} tokens
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase text-muted-foreground">Est. generation spend</p>
                <p className="mt-1 text-2xl font-semibold text-brand-900">
                  £{usage.byDay.reduce((sum, d) => sum + d.estCostGbp, 0).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">estimates from per-message token usage</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Input tokens</TableHead>
                  <TableHead>Output tokens</TableHead>
                  <TableHead>Est. £</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.byDay.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No generation activity yet.
                    </TableCell>
                  </TableRow>
                )}
                {usage.byDay.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.day}</TableCell>
                    <TableCell>{d.model}</TableCell>
                    <TableCell>{d.messages}</TableCell>
                    <TableCell>{d.inputTokens}</TableCell>
                    <TableCell>{d.outputTokens}</TableCell>
                    <TableCell>{d.estCostGbp.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
