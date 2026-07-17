"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_FILTERS, FilterSidebar, toApiFilters, type FilterState } from "@/components/filter-sidebar";
import { PageHeader } from "@/components/page-header";
import type { FilterOptions } from "@/lib/services/filter-options";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  filename: string;
  sourceType: string;
  evidenceType: string;
  wave: string;
  segmentName: string | null;
  interviewRef: string | null;
  sectionPath: string | null;
}

interface Basis {
  statement: string;
  level: "high" | "moderate" | "caution";
}

interface ExplainRow {
  n: number;
  filename: string;
  semantic: boolean;
  keyword: boolean;
  semanticRank: number | null;
  keywordRank: number | null;
  similarity: number | null;
  tsRank: number | null;
  rrfScore: number;
}

interface Explainability {
  candidateCount: number;
  weakEvidence: boolean;
  filtersApplied: Record<string, unknown>;
  results: ExplainRow[];
}

interface Verification {
  allQuotesVerified: boolean;
  hasCitations: boolean;
  invalidCitations: number[];
  quoteChecks: { quote: string; verified: boolean; reason?: string }[];
}

interface Turn {
  question: string;
  answer: string;
  citations: Citation[];
  basis: Basis | null;
  explainability: Explainability | null;
  verification: Verification | null;
  streaming: boolean;
  error?: string;
}

interface Template {
  id: string;
  name: string;
  body: string;
}

const BASIS_STYLE: Record<string, string> = {
  high: "border-green-200 bg-green-50 text-green-900",
  moderate: "border-blue-200 bg-blue-50 text-blue-900",
  caution: "border-amber-200 bg-amber-50 text-amber-900",
};

/** suggested questions as inviting category cards (not floating pills) */
const SUGGESTED_CARDS = [
  { icon: "📈", category: "Trends", question: "How has confidence changed between 2022 and 2026?", accent: "bg-sr-blue" },
  { icon: "🏦", category: "Banking", question: "Compare attitudes to banks before and after Covid", accent: "bg-sr-purple" },
  { icon: "💷", category: "Cost of living", question: "What do consumers say about cutting back?", accent: "bg-sr-orange" },
  { icon: "⚡", category: "Energy", question: "What were the biggest concerns during the energy crisis?", accent: "bg-sr-yellow" },
  { icon: "🙂", category: "Optimism", question: "How have Rising Metropolitans talked about optimism since March 2020?", accent: "bg-sr-green" },
  { icon: "🤝", category: "Trust", question: "Which segments talk most about trust and fairness?", accent: "bg-sr-cyan" },
];

const RECENTS_KEY = "sr-recent-questions";

/** Render answer text with [n] citations as links to the source viewer. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const n = Number(match[1]);
        const citation = citations.find((c) => c.n === n);
        if (!citation) return <span key={i}>{part}</span>;
        return (
          <a
            key={i}
            href={`/library/documents/${citation.documentId}?chunk=${citation.chunkId}`}
            target="_blank"
            title={`${citation.filename} · ${citation.wave}${citation.segmentName ? ` · ${citation.segmentName}` : ""}`}
            className="mx-0.5 rounded bg-brand-50 px-1 font-mono text-xs font-medium text-brand-700 no-underline transition-colors hover:bg-brand-100"
          >
            [{n}]
          </a>
        );
      })}
    </p>
  );
}

export function AskClient({
  options,
  initialQuestion,
  archiveStats,
}: {
  options: FilterOptions;
  initialQuestion?: string;
  archiveStats: { waves: number; passages: number };
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/prompt-templates")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => {});
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot localStorage read on mount
      setRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  function rememberQuestion(q: string) {
    setRecents((prev) => {
      const next = [q, ...prev.filter((r) => r !== q)].slice(0, 6);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function patchLastTurn(patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) {
    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last) next[next.length - 1] = { ...last, ...(typeof patch === "function" ? patch(last) : patch) };
      return next;
    });
  }

  async function submit(q?: string) {
    const asked = (q ?? question).trim();
    if (!asked || busy) return;
    setBusy(true);
    setQuestion("");
    rememberQuestion(asked);
    setTurns((prev) => [
      ...prev,
      { question: asked, answer: "", citations: [], basis: null, explainability: null, verification: null, streaming: true },
    ]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked, filters: toApiFilters(filters), conversationId }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        patchLastTurn({ streaming: false, error: body.error ?? "Request failed" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "meta") {
            setConversationId(event.conversationId);
            patchLastTurn({ citations: event.citations, basis: event.basis, explainability: event.explainability });
          } else if (event.type === "delta") {
            patchLastTurn((t) => ({ answer: t.answer + event.text }));
          } else if (event.type === "done") {
            patchLastTurn({ streaming: false, verification: event.verification });
          } else if (event.type === "error") {
            patchLastTurn({ streaming: false, error: event.error });
          }
        }
      }
      patchLastTurn({ streaming: false });
    } catch {
      patchLastTurn({ streaming: false, error: "Connection lost mid-answer" });
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(turn: Turn) {
    await fetch("/api/saved-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "answer",
        title: turn.question.slice(0, 200),
        content: { question: turn.question, answer: turn.answer, citations: turn.citations, basis: turn.basis },
      }),
    });
    alert("Saved to your library outputs.");
  }

  async function saveTemplate() {
    const name = prompt("Template name?");
    if (!name || !question.trim()) return;
    const res = await fetch("/api/prompt-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, body: question }),
    });
    if (res.ok) setTemplates((prev) => [...prev, { id: crypto.randomUUID(), name, body: question }]);
  }

  /** active-filter summary chips shown at the search box (§ feedback: users forget their scope) */
  const activeFilterLabels = [
    ...filters.waveIds.map((id) => options.waves.find((w) => w.id === id)?.label.replace("Wave ", "W").split(" — ")[0] ?? "wave"),
    ...filters.segmentIds.map((id) => options.segments.find((s) => s.id === id)?.name ?? "segment"),
    ...filters.themeIds.map((id) => options.themes.find((t) => t.id === id)?.name ?? "theme"),
    ...filters.sourceTypes.map((s) => s.replace(/_/g, " ")),
    ...filters.evidenceTypes.map((s) => s.replace(/_/g, " ")),
    ...(filters.dateRange ? [`${filters.dateRange.fromYear}-${String(filters.dateRange.fromMonth).padStart(2, "0")} →`] : []),
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:p-8">
      <FilterSidebar options={options} value={filters} onChange={setFilters} />

      <div className="min-w-0 flex-1">
        <PageHeader
          title="Ask the Archive"
          subtitle={`Search approved research evidence across ${archiveStats.waves} waves and ${archiveStats.passages.toLocaleString()} indexed passages — every claim cited.`}
        />

        {/* the search box is the hero, directly under the title */}
        <Card className="mt-2 gap-0 border-brand-200 py-5 shadow-md">
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How have Rising Metropolitans talked about optimism since March 2020?"
                className="h-12 flex-1 text-base shadow-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12"
                  onClick={saveTemplate}
                  disabled={!question.trim()}
                  title="Save as reusable prompt template"
                >
                  ★
                </Button>
                <Button type="submit" size="lg" className="h-12 px-6" disabled={busy || !question.trim()}>
                  {busy ? "Asking…" : "Ask"}
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {activeFilterLabels.length > 0 ? (
                <>
                  <span className="font-medium text-foreground">Searching within:</span>
                  {activeFilterLabels.map((label, i) => (
                    <span key={i} className="rounded-full bg-brand-900 px-2 py-0.5 text-[11px] font-medium text-white">
                      {label}
                    </span>
                  ))}
                  <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="underline underline-offset-2 hover:text-foreground">
                    clear all
                  </button>
                </>
              ) : (
                <span>Searching the whole archive — narrow the scope with the filters.</span>
              )}
              <span className="ml-auto hidden sm:inline">Enter to ask</span>
            </div>

            {templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                <span className="text-xs text-muted-foreground">Templates:</span>
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setQuestion(t.body)}
                    className="rounded-full"
                    title={t.body}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* empty state: suggested question cards + recent searches, not blank space */}
        {turns.length === 0 && (
          <div className="mt-8">
            <p className="text-sm font-semibold text-foreground">Suggested questions</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SUGGESTED_CARDS.map((card) => (
                <button
                  key={card.question}
                  type="button"
                  onClick={() => submit(card.question)}
                  className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:border-brand-600 hover:shadow-md"
                >
                  <div className={`h-1 w-full ${card.accent}`} />
                  <div className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="mr-1.5">{card.icon}</span>
                      {card.category}
                    </p>
                    <p className="mt-1.5 text-sm leading-5 text-foreground group-hover:text-brand-900">{card.question}</p>
                  </div>
                </button>
              ))}
            </div>

            {recents.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-semibold text-foreground">Recent searches</p>
                <ul className="mt-2 space-y-1">
                  {recents.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => submit(r)}
                        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* conversation */}
        <div className="mt-6 space-y-6">
          {turns.map((turn, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-900">You: {turn.question}</p>
              <Card className="mt-2 gap-0">
                <CardContent className="space-y-3">
                  {turn.basis && (
                    <p className={`rounded-md border px-3 py-2 text-xs ${BASIS_STYLE[turn.basis.level]}`}>
                      {turn.basis.statement}
                    </p>
                  )}
                  {turn.explainability?.weakEvidence && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                      <AlertDescription className="text-amber-900">
                        Evidence for this question is limited — treat the answer as indicative and consider widening the filters.
                      </AlertDescription>
                    </Alert>
                  )}
                  <AnswerText text={turn.answer} citations={turn.citations} />
                  {turn.streaming && <p className="text-xs text-slate-400">thinking…</p>}
                  {turn.error && <p className="text-sm text-red-600">{turn.error}</p>}

                  {turn.verification && !turn.verification.allQuotesVerified && (
                    <Alert variant="destructive">
                      <AlertTitle>⚠ Quote verification failed:</AlertTitle>
                      <AlertDescription className="text-destructive/90">
                        {turn.verification.quoteChecks
                          .filter((q) => !q.verified)
                          .map((q, j) => (
                            <p key={j}>“{q.quote.slice(0, 80)}…” could not be verified against its cited source ({q.reason}).</p>
                          ))}
                      </AlertDescription>
                    </Alert>
                  )}

                  {turn.citations.length > 0 && !turn.streaming && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
                      <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                        {turn.citations
                          .filter(() => turn.verification?.hasCitations !== false)
                          .map((c) => (
                            <li key={c.n}>
                              <a
                                href={`/library/documents/${c.documentId}?chunk=${c.chunkId}`}
                                target="_blank"
                                className="font-medium text-brand-700 underline-offset-2 hover:underline"
                              >
                                [{c.n}] {c.filename}
                              </a>{" "}
                              — {c.wave}
                              {c.segmentName ? ` · ${c.segmentName}` : ""}
                              {c.interviewRef ? ` · ${c.interviewRef}` : ""} · {c.evidenceType.replace(/_/g, " ")}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {turn.explainability && !turn.streaming && (
                    <details className="border-t border-slate-100 pt-3">
                      <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500">
                        Why these results ({turn.explainability.candidateCount} candidates)
                      </summary>
                      <Table className="mt-2 text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 px-2">#</TableHead>
                            <TableHead className="h-8 px-2">Source</TableHead>
                            <TableHead className="h-8 px-2">Matched</TableHead>
                            <TableHead className="h-8 px-2">Semantic</TableHead>
                            <TableHead className="h-8 px-2">Keyword</TableHead>
                            <TableHead className="h-8 px-2">RRF</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {turn.explainability.results.map((r) => (
                            <TableRow key={r.n}>
                              <TableCell className="px-2 py-1">[{r.n}]</TableCell>
                              <TableCell className="max-w-40 truncate px-2 py-1">{r.filename}</TableCell>
                              <TableCell className="px-2 py-1">
                                {r.semantic && r.keyword ? "both" : r.semantic ? "semantic" : "keyword"}
                              </TableCell>
                              <TableCell className="px-2 py-1">
                                {r.semanticRank ? `#${r.semanticRank} (${r.similarity?.toFixed(3)})` : "—"}
                              </TableCell>
                              <TableCell className="px-2 py-1">
                                {r.keywordRank ? `#${r.keywordRank} (${r.tsRank?.toFixed(3)})` : "—"}
                              </TableCell>
                              <TableCell className="px-2 py-1">{r.rrfScore.toFixed(4)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </details>
                  )}

                  {!turn.streaming && turn.answer && (
                    <div className="flex gap-2 border-t border-slate-100 pt-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => saveAnswer(turn)}>
                        Save to library
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${turn.answer}\n\nSources:\n${turn.citations.map((c) => `[${c.n}] ${c.filename} (${c.wave})`).join("\n")}`);
                          void fetch("/api/export/log", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ what: "answer with sources", format: "clipboard" }),
                          });
                        }}
                      >
                        Copy with sources
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
