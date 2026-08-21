"use client";

import { useState } from "react";
import { AiText } from "@/components/ai-text";
import { PageHeader } from "@/components/page-header";
import { ResearchLoader } from "@/components/research-loader";
import { ThemeTimeline } from "@/components/theme-timeline";
import { WordFrequencyPanel } from "@/components/word-frequency-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendData } from "@/lib/services/trends";

interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  filename: string;
  wave: string;
  segmentName: string | null;
}
interface CompareResponse {
  text: string;
  sideA: { label: string; citations: Citation[]; basis: { statement: string; level: string } };
  sideB: { label: string; citations: Citation[]; basis: { statement: string; level: string } };
}

const MOVEMENT_STYLE: Record<string, string> = {
  new: "border-sr-green/40 bg-sr-green/10 text-green-800",
  growing: "border-sr-blue/40 bg-sr-blue/10 text-sky-800",
  continuing: "border-slate-200 bg-slate-100 text-slate-600",
  fading: "border-sr-orange/40 bg-sr-orange/10 text-orange-800",
};
const MOVEMENT_ICON: Record<string, string> = { new: "✦", growing: "▲", continuing: "＝", fading: "▽" };

export function TrendsClient({ data, canSynthesise }: { data: TrendData; canSynthesise: boolean }) {
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function synthesise() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/trends/narrative", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not generate the trend narrative");
      return;
    }
    setResult(await res.json());
  }

  const grouped = (["new", "growing", "continuing", "fading"] as const).map((m) => ({
    movement: m,
    themes: data.movers.filter((x) => x.movement === m),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        icon="trends"
        title="Trends"
        subtitle="How themes have moved across the whole archive — new, growing, continuing and fading — with an AI cross-wave synthesis."
      />

      <div className="mt-4">
        <WordFrequencyPanel />
      </div>

      {data.points.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No indexed evidence yet. Confirm a wave to see trends.</p>
      ) : (
        <div className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-brand-900">Theme frequency across waves</CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeTimeline points={data.points} maxThemes={8} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-brand-900">
                Movement {data.earliest && data.latest && (
                  <span className="text-sm font-normal text-muted-foreground">
                    · {data.earliest.label} → {data.latest.label}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {grouped.map((g) => (
                  <div key={g.movement}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{MOVEMENT_ICON[g.movement]}</span>
                      {g.movement}
                    </p>
                    <div className="space-y-1.5">
                      {g.themes.length === 0 && <p className="text-xs text-slate-400">—</p>}
                      {g.themes.map((t) => (
                        <div
                          key={t.themeName}
                          className={`flex items-center justify-between rounded-md border px-2 py-1 text-xs ${MOVEMENT_STYLE[g.movement]}`}
                        >
                          <span className="truncate">{t.themeName}</span>
                          <span className="ml-2 shrink-0 tabular-nums opacity-70">
                            {t.earliestCount}→{t.latestCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Counts are tagged passages in a small qualitative sample — direction of travel, not statistical
                prevalence.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-brand-900">AI cross-wave synthesis</CardTitle>
              {canSynthesise && (
                <Button type="button" onClick={synthesise} disabled={busy}>
                  {busy ? "Synthesising…" : result ? "Regenerate" : "Generate narrative"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!canSynthesise && (
                <p className="text-sm text-muted-foreground">At least two waves are needed to synthesise a trend narrative.</p>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {busy && (
                <ResearchLoader
                  messages={[
                    "Reading the earliest and latest waves…",
                    "Tracing what changed across the archive…",
                    "Finding what's new, growing and fading…",
                  ]}
                />
              )}
              {result && !busy && (
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{result.sideA.label}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="secondary">{result.sideB.label}</Badge>
                  </div>
                  <AiText text={result.text} />
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {[...result.sideA.citations.map((c) => ({ ...c, side: "A" })), ...result.sideB.citations.map((c) => ({ ...c, side: "B" }))].map(
                        (c) => (
                          <li key={`${c.side}${c.n}`} id={`cite-${c.side}${c.n}`} className="scroll-mt-20 target:bg-brand-50">
                            <a href={`/library/documents/${c.documentId}?chunk=${c.chunkId}`} target="_blank" className="underline">
                              [{c.side}
                              {c.n}] {c.filename}
                            </a>{" "}
                            — {c.wave}
                            {c.segmentName ? ` · ${c.segmentName}` : ""}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
