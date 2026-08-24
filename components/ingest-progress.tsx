"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface DocumentStatus {
  id: string;
  status: string;
  error: string | null;
  warnings: number;
  chunkCount: number;
  embedded: number;
  costGbp: number | null;
}

/** Statuses meaning the pipeline has finished, either way. */
const TERMINAL = new Set(["review", "indexed", "failed", "deleted"]);

/** Plain-English stage names. "parsing" and "uploaded" tell a researcher nothing. */
const STAGE_LABEL: Record<string, string> = {
  uploaded: "Queued",
  parsing: "Reading the document",
  parsed: "Splitting into passages",
  suggesting: "AI reading it and suggesting themes",
  review: "Ready for your review",
  approved: "Indexing",
  indexed: "Searchable",
  failed: "Could not be processed",
};

export function formatGbp(value: number): string {
  if (value > 0 && value < 0.01) return "under £0.01";
  return `£${value.toFixed(2)}`;
}

/**
 * Live ingestion progress.
 *
 * Uploading used to report "done" the moment a file was registered — before it
 * had been read, tagged or embedded — and nothing updated afterwards, so a
 * researcher could not tell processing from failure without refreshing. This
 * polls until every document reaches a terminal state and reports what each one
 * cost, so AI spend is visible where it happens rather than only in a monthly
 * total.
 */
export function IngestProgress({
  documentIds,
  onAllSettled,
}: {
  documentIds: string[];
  onAllSettled?: () => void;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<DocumentStatus[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (documentIds.length === 0) return;
    let cancelled = false;
    let attempts = 0;

    async function tick() {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch("/api/documents/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: documentIds }),
        });
        if (res.ok) {
          const rows: DocumentStatus[] = await res.json();
          if (cancelled) return;
          setStatuses(rows);
          if (rows.length > 0 && rows.every((r) => TERMINAL.has(r.status))) {
            setDone(true);
            onAllSettled?.();
            router.refresh();
            return;
          }
        }
      } catch {
        // a dropped poll is not worth surfacing; the next one will catch up
      }
      // give up rather than poll forever if something upstream has stalled
      if (attempts < 150 && !cancelled) setTimeout(tick, 2000);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [documentIds, onAllSettled, router]);

  if (documentIds.length === 0 || statuses.length === 0) return null;

  const totalCost = statuses.reduce((n, s) => n + (s.costGbp ?? 0), 0);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium text-foreground">
        {done ? "Processing finished" : "Processing your upload…"}
      </p>
      {!done && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          You can leave this page — processing continues in the background.
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {statuses.map((s) => (
          <li key={s.id} className="text-xs">
            <span className={s.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
              {STAGE_LABEL[s.status] ?? s.status}
            </span>
            {s.chunkCount > 0 && (
              <span className="ml-2 text-muted-foreground">
                {s.chunkCount} passage{s.chunkCount === 1 ? "" : "s"}
                {s.embedded > 0 && s.embedded < s.chunkCount ? ` · ${s.embedded} indexed` : ""}
              </span>
            )}
            {s.warnings > 0 && <span className="ml-2 text-amber-700">{s.warnings} warning(s)</span>}
            {s.costGbp !== null && <span className="ml-2 text-muted-foreground">· {formatGbp(s.costGbp)}</span>}
            {s.error && <p className="mt-1 text-destructive">{s.error}</p>}
          </li>
        ))}
      </ul>
      {totalCost > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          AI cost for this upload: <strong>{formatGbp(totalCost)}</strong>. Every charge is itemised in
          Administration → Usage &amp; cost.
        </p>
      )}
    </div>
  );
}
