"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { FilterOptions } from "@/lib/services/filter-options";
import { PageHeader } from "@/components/page-header";
import { ResearchLoader } from "@/components/research-loader";

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
  pageRef?: string | null;
}

interface Section {
  heading: string;
  text: string;
  citations: Citation[];
  basis: { statement: string; level: string } | null;
  quoteVerified: boolean;
}

interface Draft {
  title: string;
  template: string;
  sections: Section[];
}

const TEMPLATES = [
  { value: "monthly_summary", label: "Monthly summary", needs: "wave" },
  { value: "what_changed", label: "What has changed?", needs: "wave" },
  { value: "theme_deep_dive", label: "Theme deep dive", needs: "theme" },
  { value: "deep_briefing", label: "Deep-research briefing", needs: "question" },
] as const;

export function ReportsClient({ options }: { options: FilterOptions }) {
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["value"]>("monthly_summary");
  const [waveId, setWaveId] = useState("");
  const [themeId, setThemeId] = useState("");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needs = TEMPLATES.find((t) => t.value === template)?.needs;
  const ready = needs === "wave" ? Boolean(waveId) : needs === "theme" ? Boolean(themeId) : question.trim().length > 4;

  async function generate() {
    setBusy(true);
    setError(null);
    setDraft(null);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template,
        waveId: needs === "wave" ? waveId : undefined,
        themeId: needs === "theme" ? themeId : undefined,
        themeName: needs === "theme" ? options.themes.find((t) => t.id === themeId)?.name : undefined,
        question: needs === "question" ? question : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Generation failed");
      return;
    }
    setDraft(await res.json());
  }

  function updateSection(index: number, patch: Partial<Section>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  }

  async function exportDocx() {
    if (!draft) return;
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        sections: draft.sections.map((s) => ({ heading: s.heading, text: s.text, citations: s.citations })),
      }),
    });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function copySlideReady() {
    if (!draft) return;
    const text = draft.sections
      .map((s) => {
        const bullets = s.text
          .replace(/\[\d+\]/g, "")
          .split(/(?<=[.!?])\s+/)
          .filter((sentence) => sentence.trim().length > 15)
          .slice(0, 4)
          .map((sentence) => `• ${sentence.trim()}`);
        return `${s.heading.toUpperCase()}\n${bullets.join("\n")}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(`${draft.title}\n\n${text}`);
    alert("Slide-ready copy on the clipboard.");
  }

  async function save() {
    if (!draft) return;
    await fetch("/api/saved-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "report_draft",
        title: draft.title,
        content: draft as unknown as Record<string, unknown>,
      }),
    });
    alert("Draft saved to your library outputs.");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Create Report"
        subtitle="Grounded first drafts from templates — edit every section before export. AI-generated content is labelled and must be reviewed before client use."
      />

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground">Template</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)} className="mt-1 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {needs === "wave" && (
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground">Wave</span>
              <select value={waveId} onChange={(e) => setWaveId(e.target.value)} className="mt-1 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value="">Choose…</option>
                {options.waves.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needs === "theme" && (
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground">Theme</span>
              <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="mt-1 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value="">Choose…</option>
                {options.themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needs === "question" && (
            <label className="w-full text-sm">
              <span className="block text-xs text-muted-foreground">Research question</span>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                placeholder="e.g. How has consumer confidence in the UK economy shifted, and what is driving it?"
                className="mt-1 text-sm"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Builds a multi-section, cited briefing — overview, themes, segment &amp; region differences, change over
                time, and supporting verbatim.
              </span>
            </label>
          )}
          <Button type="button" onClick={generate} disabled={!ready || busy}>
            {busy ? "Generating…" : "Generate draft"}
          </Button>
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {busy && (
        <ResearchLoader
          messages={[
            "Retrieving evidence for each section…",
            "Reading the transcripts and reports…",
            "Drafting the narrative…",
            "Attaching citations…",
          ]}
        />
      )}

      {!draft && !busy && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { t: "Monthly summary", d: "A full month's findings across mood, cost of living, energy, food, banks and outlook — one wave.", a: "bg-sr-orange" },
            { t: "What has changed?", d: "This wave against the previous one and the same month a year ago, framed as new / growing / continuing / fading.", a: "bg-sr-yellow" },
            { t: "Theme deep dive", d: "One theme over time — how it has evolved, where segments differ, and the consumer voice behind it.", a: "bg-sr-green" },
            { t: "Deep-research briefing", d: "Your own question, answered as a multi-section cited briefing — overview, themes, segment & region differences, change over time and verbatim.", a: "bg-sr-blue" },
          ].map((x) => (
            <Card key={x.t} className="overflow-hidden pt-0">
              <div className={`h-1 w-full ${x.a}`} />
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-brand-900">{x.t}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{x.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-2/3 rounded-lg border border-transparent px-2 py-1 text-xl font-semibold text-brand-900 hover:border-input"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={save}>
                Save draft
              </Button>
              <Button type="button" variant="outline" onClick={copySlideReady}>
                Slide-ready copy
              </Button>
              <Button type="button" onClick={exportDocx}>
                Export to Word
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {draft.sections.map((section, i) => (
              <Card key={i}>
                <CardContent>
                <input
                  value={section.heading}
                  onChange={(e) => updateSection(i, { heading: e.target.value })}
                  className="w-full rounded-lg border border-transparent px-1 py-0.5 font-medium text-brand-900 hover:border-input"
                />
                {section.basis && (
                  <p className="mt-1 text-xs text-muted-foreground">{section.basis.statement}</p>
                )}
                {!section.quoteVerified && (
                  <Alert variant="destructive" className="mt-1">
                    <AlertDescription>
                      ⚠ A quote in this section could not be verified against its source — check before use.
                    </AlertDescription>
                  </Alert>
                )}
                <Textarea
                  value={section.text}
                  onChange={(e) => updateSection(i, { text: e.target.value })}
                  rows={Math.min(16, Math.max(4, section.text.split("\n").length + 2))}
                  className="mt-2 text-sm leading-6"
                />
                {section.citations.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Sources ({section.citations.length})</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {section.citations.map((c) => (
                        <li key={`${c.n}-${c.chunkId}`}>
                          [{c.n}] {c.filename} — {c.wave}
                          {c.segmentName ? ` · ${c.segmentName}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
