"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResearchLoader } from "@/components/research-loader";

interface FrequencyItem {
  term: string;
  count: number;
}
interface Result {
  topic: string | null;
  words: FrequencyItem[];
  phrases: FrequencyItem[];
  chunkCount: number;
}

/** Item 4: most common words & phrases over a period, optionally about a topic.
 *  Counts over reports only (no transcripts), matching the archive's use. */
export function WordFrequencyPanel() {
  const [topic, setTopic] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const filters: Record<string, unknown> = { sourceTypes: ["report", "debrief_deck"] };
    if (from && to) {
      const [fy, fm] = from.split("-").map(Number);
      const [ty, tm] = to.split("-").map(Number);
      filters.dateRange = { fromYear: fy, fromMonth: fm, toYear: ty, toMonth: tm };
    }
    const res = await fetch("/api/word-frequency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim() || undefined, filters }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not compute word frequency. Try a narrower period.");
      return;
    }
    setResult(await res.json());
  }

  const maxWord = result?.words[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-brand-900">Most common words &amp; phrases</CardTitle>
        <p className="text-xs text-muted-foreground">
          Across reports in the chosen period. Add a topic to see the words used to describe it — e.g.{" "}
          <em>the economy</em>, <em>house buying</em>, <em>COVID</em>.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Topic (optional)</span>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. the economy" className="h-9" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">From</span>
            <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">To</span>
            <input type="month" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm" />
          </label>
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? "Counting…" : "Analyse"}
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {busy && <ResearchLoader messages={["Reading the reports…", "Counting words and phrases…", "Ranking the most common language…"]} />}

        {result && !busy && (
          <div className="mt-5">
            <p className="text-xs text-muted-foreground">
              {result.topic ? (
                <>Language used to describe <strong>{result.topic}</strong></>
              ) : (
                <>Most common language</>
              )}{" "}
              across {result.chunkCount} passage{result.chunkCount === 1 ? "" : "s"}
              {result.chunkCount < 5 ? " — small base, treat as indicative only." : "."}
            </p>

            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Words</h3>
                {result.words.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No repeated words in scope.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {result.words.map((w) => (
                      <span
                        key={w.term}
                        title={`${w.count} mentions`}
                        className="text-brand-800"
                        style={{ fontSize: `${0.8 + (w.count / maxWord) * 1.1}rem`, opacity: 0.55 + (w.count / maxWord) * 0.45 }}
                      >
                        {w.term}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phrases</h3>
                {result.phrases.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No repeated phrases in scope.</p>
                ) : (
                  <ul className="mt-3 space-y-1">
                    {result.phrases.map((p) => (
                      <li key={p.term} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">{p.term}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{p.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
