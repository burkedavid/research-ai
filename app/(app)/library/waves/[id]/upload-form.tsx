"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_TYPES = [
  ["transcript", "Transcript"],
  ["report", "Report (Word)"],
  ["crib_sheet", "Crib sheet"],
  ["moderator_notes", "Moderator notes"],
  ["discussion_guide", "Discussion guide"],
  ["debrief_deck", "Debrief deck (PowerPoint)"],
  ["coding_frame", "Coding frame"],
  ["tabular", "Tabular data (Excel/CSV)"],
  ["reference_data", "Third-party data / published stats"],
  ["other", "Other"],
] as const;

const selectClasses =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface UploadStatus {
  filename: string;
  state: "uploading" | "processing" | "done" | "error";
  message?: string;
}

export function UploadForm({ waveId, storageDriver }: { waveId: string; storageDriver: "local" | "vercel-blob" }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceType, setSourceType] = useState<string>("transcript");
  // third-party provenance — required so attribution and redistribution
  // rights travel with the document rather than living in someone's memory
  const [publisher, setPublisher] = useState("");
  const [licence, setLicence] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const isReference = sourceType === "reference_data";
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [busy, setBusy] = useState(false);

  function setStatus(filename: string, patch: Partial<UploadStatus>) {
    setStatuses((prev) => prev.map((s) => (s.filename === filename ? { ...s, ...patch } : s)));
  }

  async function storeFile(file: File): Promise<{ url: string; pathname: string }> {
    if (storageDriver === "vercel-blob") {
      const { upload } = await import("@vercel/blob/client");
      const result = await upload(`uploads/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      return { url: result.url, pathname: result.pathname };
    }
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
    return res.json();
  }

  async function handleUpload() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setStatuses(files.map((f) => ({ filename: f.name, state: "uploading" })));

    for (const file of files) {
      try {
        const stored = await storeFile(file);
        setStatus(file.name, { state: "processing" });
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waveId,
            blobUrl: stored.url,
            blobPathname: stored.pathname,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sourceType,
            ...(isReference ? { publisher, licence, sourceUrl } : {}),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Registration failed");
        }
        setStatus(file.name, { state: "done" });
      } catch (err) {
        setStatus(file.name, { state: "error", message: err instanceof Error ? err.message : String(err) });
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Upload documents</CardTitle>
        <CardDescription>
          Word, PowerPoint, Excel/CSV, PDF, plain-text and VTT transcripts. Files are parsed, chunked and queued for
          your review before anything becomes searchable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isReference && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900">
              Third-party material is stored as <strong>context, not consumer voice</strong> — it is excluded from
              interview and wave counts, labelled on every citation, and the AI is instructed never to present it as
              something consumers said. Record the publisher and licence so attribution and redistribution rights stay
              with the document. Check the licence permits use in a client-facing tool before uploading.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Publisher (e.g. ONS)"
                aria-label="Publisher"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <input
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
                placeholder="Licence (e.g. OGL v3.0)"
                aria-label="Licence"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Source URL"
                aria-label="Source URL"
                className="h-8 min-w-56 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className={selectClasses}
            aria-label="Source type"
          >
            {SOURCE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground"
            aria-label="Files"
          />
          <Button type="button" onClick={handleUpload} disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {statuses.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {statuses.map((s) => (
              <li key={s.filename} className="flex items-center gap-2">
                <span
                  className={
                    s.state === "done"
                      ? "text-green-700"
                      : s.state === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {s.state === "done" ? "✓" : s.state === "error" ? "✕" : "…"}
                </span>
                <span>{s.filename}</span>
                {s.message && <span className="text-xs text-destructive">{s.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
