"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatGbp } from "@/components/ingest-progress";

export interface ThemeCoverageRow {
  themeId: string;
  themeName: string;
  taggedPassages: number;
  runStatus: string | null;
  runId: string | null;
  candidatesTotal: number;
  candidatesDone: number;
  tagsAdded: number;
  estCostGbp: number | null;
  incomplete: boolean;
}

interface RunStatus {
  id: string;
  themeName: string;
  status: string;
  candidatesTotal: number;
  candidatesDone: number;
  tagsAdded: number;
  estCostGbp: number | null;
  error: string | null;
}

const RUNNING = new Set(["pending", "running"]);

/**
 * Applying a theme to the archive that was indexed before it existed.
 *
 * Two clicks on purpose: the first only selects and prices the work, the second
 * is the one that spends money. Nothing here ever starts a paid run on its own.
 */
export function ThemeCoverage({ rows }: { rows: ThemeCoverageRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Record<string, { runId: string; candidates: number; estCostGbp: number }>>({});
  const [live, setLive] = useState<RunStatus | null>(null);

  const poll = useCallback(
    async (runId: string) => {
      const res = await fetch("/api/admin/retag/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) return true;
      const status: RunStatus = await res.json();
      setLive(status);
      if (!RUNNING.has(status.status)) {
        router.refresh();
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    if (!live || !RUNNING.has(live.status)) return;
    const id = setTimeout(() => void poll(live.id), 2000);
    return () => clearTimeout(id);
  }, [live, poll]);

  async function planRun(themeId: string) {
    setBusy(themeId);
    setError(null);
    const res = await fetch("/api/admin/retag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeId }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not work out what needs re-reading");
      return;
    }
    setPlan({ ...plan, [themeId]: await res.json() });
  }

  async function startRun(themeId: string, runId: string) {
    setBusy(themeId);
    setError(null);
    const res = await fetch("/api/admin/retag", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not start");
      return;
    }
    setLive(await res.json());
  }

  const needsWork = rows.filter((r) => r.incomplete);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            A theme only tags documents uploaded <em>after</em> it was added. Themes added since your archive was
            loaded are listed here: applying one re-reads the passages most likely to match and tags the ones that do.
          </p>
          <p className="mt-2">
            This costs money, because the AI reads every candidate passage. You are shown the number of passages and
            the estimated cost first, and nothing is spent until you press <strong>Apply</strong>. Existing tags are
            never changed, and tags a reviewer confirmed are never touched.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {live && (
        <Card className="border-brand-200 bg-brand-50/60">
          <CardContent className="text-sm">
            <p className="font-medium text-brand-900">
              {RUNNING.has(live.status) ? "Applying" : "Finished"} “{live.themeName}”
            </p>
            <p className="mt-1 text-muted-foreground">
              {live.candidatesDone} of {live.candidatesTotal} passages read · {live.tagsAdded} tagged so far
              {live.estCostGbp != null && ` · estimated ${formatGbp(live.estCostGbp)} for the full run`}
            </p>
            {RUNNING.has(live.status) && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full bg-brand-800 transition-all"
                  style={{
                    width: `${live.candidatesTotal > 0 ? Math.round((live.candidatesDone / live.candidatesTotal) * 100) : 0}%`,
                  }}
                />
              </div>
            )}
            {live.status === "truncated" && (
              <p className="mt-2 text-amber-800">
                Stopped at the safety limit, so this theme still does not cover the whole archive. Apply it again to
                continue.
              </p>
            )}
            {live.error && <p className="mt-2 text-destructive">{live.error}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Actual spend is itemised under Usage &amp; cost as “retag”.
            </p>
          </CardContent>
        </Card>
      )}

      {needsWork.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every theme covers the whole archive. Nothing needs re-reading.
        </p>
      ) : (
        needsWork.map((r) => {
          const planned = plan[r.themeId];
          return (
            <Card key={r.themeId}>
              <CardContent className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-slate-900">{r.themeName}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  not applied to the existing archive
                </span>
                <span className="text-xs text-muted-foreground">{r.taggedPassages} passages tagged so far</span>
                <span className="flex-1" />
                {!planned ? (
                  <Button size="sm" variant="outline" disabled={busy === r.themeId} onClick={() => planRun(r.themeId)}>
                    {busy === r.themeId ? "Checking…" : "Check what this would cost"}
                  </Button>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {planned.candidates} passages · est. {formatGbp(planned.estCostGbp)}
                    </span>
                    <Button
                      size="sm"
                      disabled={busy === r.themeId || planned.candidates === 0}
                      onClick={() => startRun(r.themeId, planned.runId)}
                    >
                      {planned.candidates === 0 ? "Nothing to apply" : "Apply — spend this"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
