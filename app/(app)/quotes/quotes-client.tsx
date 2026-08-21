"use client";

import { useState } from "react";
import { EMPTY_FILTERS, FilterSidebar, toApiFilters, type FilterState } from "@/components/filter-sidebar";
import { PageHeader } from "@/components/page-header";
import { SentimentBadge } from "@/components/sentiment-badge";
import { ResearchLoader } from "@/components/research-loader";
import type { FilterOptions } from "@/lib/services/filter-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** soft pastel tints from the Sentiment Research mark */
const SUGGESTION_TINTS = [
  "border-sr-orange/40 bg-sr-orange/10 text-orange-900 hover:bg-sr-orange/20",
  "border-sr-green/40 bg-sr-green/10 text-green-900 hover:bg-sr-green/20",
  "border-sr-blue/40 bg-sr-blue/10 text-sky-900 hover:bg-sr-blue/20",
  "border-sr-purple/40 bg-sr-purple/10 text-purple-900 hover:bg-sr-purple/20",
  "border-sr-magenta/40 bg-sr-magenta/10 text-pink-900 hover:bg-sr-magenta/20",
  "border-sr-cyan/40 bg-sr-cyan/10 text-teal-900 hover:bg-sr-cyan/20",
];

interface Quote {
  chunkId: string;
  documentId: string;
  quote: string;
  question: string | null;
  interviewRef: string | null;
  segmentName: string | null;
  wave: string;
  reportDate: string | null;
  filename: string;
  sentiment: string | null;
  region: string | null;
  matchedSemantic: boolean;
  matchedKeyword: boolean;
}

/** "2026-07-01" → "1 Jul 2026"; falls back to the wave month label. */
function whenLabel(q: { reportDate: string | null; wave: string }): string {
  if (q.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(q.reportDate)) {
    const [y, m, d] = q.reportDate.split("-").map(Number);
    const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d} ${months[m]} ${y}`;
  }
  return q.wave;
}

export function QuotesClient({
  options,
  hasTranscriptAccess,
  suggestions,
}: {
  options: FilterOptions;
  hasTranscriptAccess: boolean;
  /** starter searches derived from the indexed archive, or an admin override */
  suggestions: string[];
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [shortlist, setShortlist] = useState<Quote[]>([]);
  const [showQuestions, setShowQuestions] = useState(true);
  const [collapse, setCollapse] = useState(true);
  const [weak, setWeak] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, filters: toApiFilters(filters), collapseDuplicates: collapse }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Search failed");
      return;
    }
    const data = await res.json();
    setQuotes(data.quotes);
    setWeak(data.weakEvidence);
  }

  function toggleShortlist(quote: Quote) {
    setShortlist((prev) =>
      prev.some((q) => q.chunkId === quote.chunkId && q.quote === quote.quote)
        ? prev.filter((q) => !(q.chunkId === quote.chunkId && q.quote === quote.quote))
        : [...prev, quote],
    );
  }

  function exportShortlist() {
    const text = shortlist
      .map((q) => `"${q.quote}"\n— ${q.interviewRef ?? "consumer"}${q.segmentName ? `, ${q.segmentName}` : ""}, ${q.wave} (${q.filename})`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    void fetch("/api/export/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ what: "quote shortlist", format: "clipboard", itemCount: shortlist.length }),
    });
    alert(`${shortlist.length} quote(s) copied with source references.`);
  }

  async function exportCsv() {
    const res = await fetch("/api/export/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "quote-shortlist",
        headers: ["Quote", "Interview", "Segment", "Wave", "Source file"],
        rows: shortlist.map((q) => [q.quote, q.interviewRef, q.segmentName, q.wave, q.filename]),
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quote-shortlist.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveShortlist() {
    await fetch("/api/saved-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "quote_list",
        title: `Quotes: ${query.slice(0, 150)}`,
        content: { query, quotes: shortlist },
      }),
    });
    alert("Shortlist saved to your library outputs.");
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:p-8">
      <FilterSidebar options={options} value={filters} onChange={setFilters} showEvidenceTypes={false} />

      <div className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col">
        <PageHeader
          icon="quotes"
          title="Find Quotes"
          subtitle="Direct consumer verbatim only, ranked by relevance, with speaker and source references."
        />

        {!hasTranscriptAccess && (
          <Alert className="mt-4 border-sky-200 bg-sky-50 text-sky-900">
            <AlertDescription className="text-sky-900">
              You&apos;re seeing verbatim quoted in reports (attributed by segment and region). Raw transcript
              verbatim needs transcript access — ask an administrator if you need it.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={search} className="mt-4 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={suggestions.length ? `e.g. ${suggestions.slice(0, 3).join(", ")}…` : "Search for a phrase consumers used"}
            className="h-9 flex-1"
          />
          <Button type="submit" size="lg" disabled={busy || !query.trim()}>
            {busy ? "Searching…" : "Search"}
          </Button>
        </form>
        <div className="mt-3 flex gap-4 text-xs text-slate-600">
          <Label className="gap-1.5 text-xs font-normal text-slate-600">
            <Checkbox checked={showQuestions} onCheckedChange={(v) => setShowQuestions(v)} />
            show moderator question
          </Label>
          <Label className="gap-1.5 text-xs font-normal text-slate-600">
            <Checkbox checked={collapse} onCheckedChange={(v) => setCollapse(v)} />
            collapse near-duplicates
          </Label>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription className="text-destructive/90">{error}</AlertDescription>
          </Alert>
        )}
        {weak && quotes && (
          <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription className="text-amber-900">
              Evidence for this search is limited — few strong matches were found.
            </AlertDescription>
          </Alert>
        )}

        {busy && (
          <ResearchLoader
            messages={["Searching for verbatim…", "Matching consumer voice…", "Ranking the strongest quotes…"]}
          />
        )}

        {!busy && quotes === null && (
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-xl text-center">
              <p className="text-sm font-medium text-muted-foreground">Popular verbatim searches…</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition hover:shadow-sm ${SUGGESTION_TINTS[i % SUGGESTION_TINTS.length]}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Every quote is word-for-word — from an interview transcript or attributed inline in a report — with its segment, region and date attached. Shortlist the strong ones to copy or export with sources.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {quotes?.length === 0 && <p className="text-sm text-slate-400">No quotes found. Try widening the filters.</p>}
          {quotes?.map((quote, i) => {
            const listed = shortlist.some((q) => q.chunkId === quote.chunkId && q.quote === quote.quote);
            return (
              <Card key={`${quote.chunkId}-${i}`} className={listed ? "ring-brand-200" : undefined}>
                <CardContent className="space-y-2">
                  {showQuestions && quote.question && (
                    <p className="text-xs italic text-slate-400">Moderator: {quote.question}</p>
                  )}
                  <blockquote className="border-l-2 border-brand-300 pl-3 text-sm text-slate-800">
                    “{quote.quote}”
                  </blockquote>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <SentimentBadge sentiment={quote.sentiment} />
                    <span>
                      {quote.interviewRef ?? "consumer"}
                      {quote.segmentName ? ` · ${quote.segmentName}` : ""}
                      {quote.region ? ` · ${quote.region}` : ""} · {whenLabel(quote)}
                    </span>
                    <a
                      href={`/library/documents/${quote.documentId}?chunk=${quote.chunkId}`}
                      target="_blank"
                      className="font-medium text-brand-700 underline-offset-2 hover:underline"
                    >
                      {quote.filename}
                    </a>
                    <Badge variant="secondary" className="font-normal">
                      {quote.matchedSemantic && quote.matchedKeyword ? "semantic + keyword" : quote.matchedSemantic ? "semantic" : "keyword"}
                    </Badge>
                    <Button
                      type="button"
                      variant={listed ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => toggleShortlist(quote)}
                      className={listed ? "ml-auto text-green-700" : "ml-auto"}
                    >
                      {listed ? "✓ shortlisted" : "add to shortlist"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {shortlist.length > 0 && (
        <aside className="w-full lg:w-72 lg:shrink-0">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Shortlist ({shortlist.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-h-96 space-y-2 overflow-y-auto text-xs text-slate-600">
                {shortlist.map((q, i) => (
                  <li key={i} className="border-b border-slate-100 pb-1">
                    “{q.quote.slice(0, 80)}…”
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={exportShortlist}>
                  Copy with sources
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                  CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={saveShortlist}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      )}
    </div>
  );
}
