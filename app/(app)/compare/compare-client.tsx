"use client";

import { useState } from "react";
import { AiText } from "@/components/ai-text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import type { FilterOptions } from "@/lib/services/filter-options";
import { PageHeader } from "@/components/page-header";
import { ResearchLoader } from "@/components/research-loader";

interface SideState {
  label: string;
  mode: "wave" | "range" | "segment";
  waveId: string;
  from: string;
  to: string;
  segmentId: string;
}

interface Citation {
  n: number;
  documentId: string;
  chunkId: string;
  filename: string;
  wave: string;
  segmentName: string | null;
  evidenceType: string;
}

interface CompareResponse {
  text: string;
  sideA: { label: string; citations: Citation[]; basis: { statement: string; level: string } };
  sideB: { label: string; citations: Citation[]; basis: { statement: string; level: string } };
}

function sideToFilters(side: SideState): Record<string, unknown> {
  if (side.mode === "wave" && side.waveId) return { waveIds: [side.waveId] };
  if (side.mode === "segment" && side.segmentId) return { segmentIds: [side.segmentId] };
  if (side.mode === "range" && side.from && side.to) {
    const [fy, fm] = side.from.split("-").map(Number);
    const [ty, tm] = side.to.split("-").map(Number);
    return { dateRange: { fromYear: fy, fromMonth: fm, toYear: ty, toMonth: tm } };
  }
  return {};
}

function SidePicker({ side, setSide, options, title }: { side: SideState; setSide: (s: SideState) => void; options: FilterOptions; title: string }) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          value={side.label}
          onChange={(e) => setSide({ ...side, label: e.target.value })}
          placeholder="Label (e.g. Pre-Covid)"
        />
        <div className="mt-2 flex gap-3 text-xs">
          {(["wave", "range", "segment"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" checked={side.mode === m} onChange={() => setSide({ ...side, mode: m })} />
              {m === "wave" ? "single wave" : m === "range" ? "date range" : "segment"}
            </label>
          ))}
        </div>
        {side.mode === "wave" && (
          <span className="mt-2 block">
            <Select
              value={side.waveId}
              onChange={(e) => setSide({ ...side, waveId: e.target.value, label: side.label || options.waves.find((w) => w.id === e.target.value)?.label || "" })}
            >
              <option value="">Choose a wave…</option>
              {options.waves.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
          </span>
        )}
        {side.mode === "range" && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <input type="month" value={side.from} onChange={(e) => setSide({ ...side, from: e.target.value })} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            <span className="text-muted-foreground">→</span>
            <input type="month" value={side.to} onChange={(e) => setSide({ ...side, to: e.target.value })} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        )}
        {side.mode === "segment" && (
          <span className="mt-2 block">
            <Select
              value={side.segmentId}
              onChange={(e) => setSide({ ...side, segmentId: e.target.value, label: side.label || options.segments.find((s) => s.id === e.target.value)?.name || "" })}
            >
              <option value="">Choose a segment…</option>
              {options.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </span>
        )}
      </CardContent>
    </Card>
  );
}

const BASIS_STYLE: Record<string, string> = {
  high: "border-green-200 bg-green-50 text-green-900",
  moderate: "border-blue-200 bg-blue-50 text-blue-900",
  caution: "border-amber-200 bg-amber-50 text-amber-900",
};

export function CompareClient({ options }: { options: FilterOptions }) {
  const [sideA, setSideA] = useState<SideState>({ label: "", mode: "wave", waveId: "", from: "", to: "", segmentId: "" });
  const [sideB, setSideB] = useState<SideState>({ label: "", mode: "wave", waveId: "", from: "", to: "", segmentId: "" });
  const [question, setQuestion] = useState("What has changed in consumer sentiment, concerns and behaviour?");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        labelA: sideA.label || "Period A",
        filtersA: sideToFilters(sideA),
        labelB: sideB.label || "Period B",
        filtersB: sideToFilters(sideB),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Comparison failed");
      return;
    }
    setResult(await res.json());
  }

  async function save() {
    if (!result) return;
    await fetch("/api/saved-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "comparison",
        title: `${result.sideA.label} vs ${result.sideB.label}`,
        content: result as unknown as Record<string, unknown>,
      }),
    });
    alert("Comparison saved to your library outputs.");
  }

  const ready = Boolean(sideToFilters(sideA) && Object.keys(sideToFilters(sideA)).length && Object.keys(sideToFilters(sideB)).length);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        icon="compare"
        title="Compare Time Periods"
        subtitle="Any two waves, ranges or segments — framed as new, growing, continuing and fading."
      />

      <div className="mt-6 flex flex-col gap-4 lg:flex-row">
        <SidePicker side={sideA} setSide={setSideA} options={options} title="Period A (earlier / baseline)" />
        <SidePicker side={sideB} setSide={setSideB} options={options} title="Period B (later / comparison)" />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="flex-1" />
        <Button type="button" onClick={run} disabled={!ready || busy} className="sm:w-auto">
          {busy ? "Comparing…" : "Compare"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {busy && (
        <ResearchLoader
          messages={[
            "Retrieving both periods…",
            "Reading the evidence side by side…",
            "Finding what's new, growing and fading…",
          ]}
        />
      )}

      {result && (
        <Card className="mt-6">
          <CardContent>
          <div className="flex flex-col gap-2 lg:flex-row">
            <p className={`flex-1 rounded-md border px-3 py-2 text-xs ${BASIS_STYLE[result.sideA.basis.level]}`}>
              A — {result.sideA.label}: {result.sideA.basis.statement}
            </p>
            <p className={`flex-1 rounded-md border px-3 py-2 text-xs ${BASIS_STYLE[result.sideB.basis.level]}`}>
              B — {result.sideB.label}: {result.sideB.basis.statement}
            </p>
          </div>
          <AiText text={result.text} className="mt-4" />

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-3 lg:grid-cols-2">
            {[result.sideA, result.sideB].map((side, i) => (
              <div key={i}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Evidence {i === 0 ? "A" : "B"} — {side.label}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {side.citations.map((c) => (
                    <li key={c.n} id={`cite-${i === 0 ? "A" : "B"}${c.n}`} className="scroll-mt-20 target:bg-brand-50">
                      <a href={`/library/documents/${c.documentId}?chunk=${c.chunkId}`} target="_blank" className="underline">
                        [{i === 0 ? "A" : "B"}{c.n}] {c.filename}
                      </a>{" "}
                      — {c.wave}
                      {c.segmentName ? ` · ${c.segmentName}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={save}>
              Save to library
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(result.text)}
            >
              Copy text
            </Button>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
