"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IngestProgress } from "@/components/ingest-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_TYPES = [
  ["report", "Report (Word)"],
  ["debrief_deck", "Debrief deck (PowerPoint)"],
  ["crib_sheet", "Crib sheet"],
  ["moderator_notes", "Moderator notes"],
  ["discussion_guide", "Discussion guide"],
  ["coding_frame", "Coding frame"],
  ["tabular", "Tabular data (Excel/CSV)"],
  ["other", "Other"],
] as const;

const selectClasses =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface Row {
  filename: string;
  state: "uploading" | "done" | "error";
  detail?: string;
}

/**
 * Bulk report upload (item 2). Each file is routed to the wave for its own
 * fieldwork month, read from the filename date (e.g. 01.07.26) — so a whole
 * back-catalogue of varying cadence loads in one go without creating waves by
 * hand. Files whose name has no readable date are flagged, not guessed.
 */
export function BulkUploadForm({
  projects,
  storageDriver,
}: {
  projects: { id: string; name: string }[];
  storageDriver: "local" | "vercel-blob";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [sourceType, setSourceType] = useState("report");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  /** documents accepted for processing, polled for live progress + cost */
  const [tracked, setTracked] = useState<string[]>([]);

  function patch(filename: string, p: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.filename === filename ? { ...r, ...p } : r)));
  }

  async function storeFile(file: File): Promise<{ url: string; pathname: string }> {
    if (storageDriver === "vercel-blob") {
      const { upload } = await import("@vercel/blob/client");
      const result = await upload(`uploads/${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
      return { url: result.url, pathname: result.pathname };
    }
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
    return res.json();
  }

  async function run() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0 || !projectId) return;
    setBusy(true);
    setRows(files.map((f) => ({ filename: f.name, state: "uploading" as const })));
    setTracked([]);
    const created: string[] = [];

    for (const file of files) {
      try {
        const stored = await storeFile(file);
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autoDateProjectId: projectId,
            blobUrl: stored.url,
            blobPathname: stored.pathname,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sourceType,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Upload failed");
        if (body.documentId) created.push(body.documentId as string);
        patch(file.name, { state: "done", detail: body.reportDate ? `dated ${body.reportDate}` : "queued for review" });
      } catch (err) {
        patch(file.name, { state: "error", detail: err instanceof Error ? err.message : String(err) });
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    setTracked(created);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
        Bulk upload reports (auto-date)
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Bulk upload reports</CardTitle>
        <CardDescription>
          Each file is filed under the wave for its own month, read from the date in the filename (e.g. 01.07.26). Files
          with no readable date are flagged so you can rename or file them manually.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="mr-1 text-xs text-muted-foreground">Project</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClasses} aria-label="Project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-1 text-xs text-muted-foreground">Type</span>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={selectClasses} aria-label="Source type">
              {SOURCE_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <input ref={fileRef} type="file" multiple className="text-sm" aria-label="Files" />
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? "Uploading…" : "Upload all"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        {rows.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.filename}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={r.state === "done" ? "text-green-700" : r.state === "error" ? "text-destructive" : "text-muted-foreground"}>
                    {r.state === "done" ? "✓" : r.state === "error" ? "✕" : "…"}
                  </span>
                  <span className="font-medium">{r.filename}</span>
                  {r.detail && r.state !== "error" && <span className="text-xs text-muted-foreground">{r.detail}</span>}
                </div>
                {/* a rejected file gets its own block — the explanation is a
                    sentence or two and is unreadable squeezed onto the row */}
                {r.detail && r.state === "error" && (
                  <p className="ml-6 mt-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs leading-relaxed text-destructive">
                    {r.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <IngestProgress documentIds={tracked} />
      </CardContent>
    </Card>
  );
}
