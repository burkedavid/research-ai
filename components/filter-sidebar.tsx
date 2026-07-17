"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FilterOptions } from "@/lib/services/filter-options";

export interface FilterState {
  waveIds: string[];
  segmentIds: string[];
  themeIds: string[];
  sourceTypes: string[];
  evidenceTypes: string[];
  sentiments: string[];
  dateRange: { fromYear: number; fromMonth: number; toYear: number; toMonth: number } | null;
}

export const EMPTY_FILTERS: FilterState = {
  waveIds: [],
  segmentIds: [],
  themeIds: [],
  sourceTypes: [],
  evidenceTypes: [],
  sentiments: [],
  dateRange: null,
};

/** Convert UI state to the API filter payload, omitting empty entries. */
export function toApiFilters(f: FilterState): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (f.waveIds.length) out.waveIds = f.waveIds;
  if (f.segmentIds.length) out.segmentIds = f.segmentIds;
  if (f.themeIds.length) out.themeIds = f.themeIds;
  if (f.sourceTypes.length) out.sourceTypes = f.sourceTypes;
  if (f.evidenceTypes.length) out.evidenceTypes = f.evidenceTypes;
  if (f.sentiments.length) out.sentiments = f.sentiments;
  if (f.dateRange) out.dateRange = f.dateRange;
  return Object.keys(out).length ? out : undefined;
}

const SOURCE_TYPES = ["report", "transcript", "crib_sheet", "moderator_notes", "discussion_guide", "debrief_deck", "coding_frame", "tabular", "other"];
const EVIDENCE_TYPES = ["direct_quote", "researcher_summary", "guide", "context"];
const SENTIMENTS = ["positive", "negative", "neutral", "mixed"];

/** Section accent dots drawn from the Sentiment Research mark's palette. */
const ACCENTS = {
  date: "bg-sr-orange",
  waves: "bg-sr-yellow",
  segments: "bg-sr-green",
  themes: "bg-sr-cyan",
  sources: "bg-sr-blue",
  evidence: "bg-sr-purple",
  sentiment: "bg-sr-magenta",
} as const;

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-full bg-brand-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
          : "rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-brand-600 hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

function Section({
  title,
  accent,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  accent: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || count > 0;
  return (
    <div className="border-b border-border/60 py-2.5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className={`size-1.5 rounded-full ${accent}`} />
        <span className="text-xs font-semibold tracking-wide text-foreground">{title}</span>
        {count > 0 && (
          <Badge className="h-4 min-w-4 rounded-full bg-brand-900 px-1 text-[10px] text-white">{count}</Badge>
        )}
        <span className={`ml-auto text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>
      {expanded && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterSidebar({
  options,
  value,
  onChange,
  showEvidenceTypes = true,
}: {
  options: FilterOptions;
  value: FilterState;
  onChange: (next: FilterState) => void;
  showEvidenceTypes?: boolean;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const active = [
    ...value.waveIds.map((id) => ({ label: options.waves.find((w) => w.id === id)?.label ?? "wave", clear: () => onChange({ ...value, waveIds: value.waveIds.filter((v) => v !== id) }) })),
    ...value.segmentIds.map((id) => ({ label: options.segments.find((s) => s.id === id)?.name ?? "segment", clear: () => onChange({ ...value, segmentIds: value.segmentIds.filter((v) => v !== id) }) })),
    ...value.themeIds.map((id) => ({ label: options.themes.find((t) => t.id === id)?.name ?? "theme", clear: () => onChange({ ...value, themeIds: value.themeIds.filter((v) => v !== id) }) })),
    ...value.sourceTypes.map((s) => ({ label: s.replace(/_/g, " "), clear: () => onChange({ ...value, sourceTypes: value.sourceTypes.filter((v) => v !== s) }) })),
    ...value.evidenceTypes.map((s) => ({ label: s.replace(/_/g, " "), clear: () => onChange({ ...value, evidenceTypes: value.evidenceTypes.filter((v) => v !== s) }) })),
    ...value.sentiments.map((s) => ({ label: s, clear: () => onChange({ ...value, sentiments: value.sentiments.filter((v) => v !== s) }) })),
    ...(value.dateRange
      ? [{
          label: `${value.dateRange.fromYear}-${String(value.dateRange.fromMonth).padStart(2, "0")} → ${value.dateRange.toYear < 2100 ? `${value.dateRange.toYear}-${String(value.dateRange.toMonth).padStart(2, "0")}` : "now"}`,
          clear: () => onChange({ ...value, dateRange: null }),
        }]
      : []),
  ];

  return (
    <aside className="w-full lg:w-64 lg:shrink-0">
      <Card className="gap-0 py-0 lg:sticky lg:top-4 lg:py-4">
        {/* mobile: a compact toggle so filters don't fill the top of the page.
            desktop: a static header, panel always open. */}
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="flex w-full items-center gap-2 px-4 py-3 text-left lg:hidden"
        >
          <span className="text-sm font-semibold">Filters</span>
          {active.length > 0 && (
            <span className="rounded-full bg-brand-900 px-1.5 text-[11px] font-medium text-white">{active.length}</span>
          )}
          <span className={`ml-auto text-muted-foreground transition-transform ${panelOpen ? "rotate-90" : ""}`}>›</span>
        </button>

        <CardHeader className="hidden px-4 pb-3 lg:block">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Filters</CardTitle>
            {active.length > 0 && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                clear all
              </button>
            )}
          </div>
          {active.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={chip.clear}
                  title="Remove filter"
                  className="group flex items-center gap-1 rounded-full bg-brand-900 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-white transition hover:bg-brand-700"
                >
                  {chip.label}
                  <span className="rounded-full px-0.5 text-brand-200 group-hover:text-white">✕</span>
                </button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className={`px-4 pb-4 pt-0 lg:pb-0 lg:block ${panelOpen ? "block" : "hidden"}`}>
          {/* active-filter chips inside the collapsible on mobile so scope stays visible */}
          {active.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 lg:hidden">
              {active.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={chip.clear}
                  className="group flex items-center gap-1 rounded-full bg-brand-900 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-white"
                >
                  {chip.label}
                  <span className="rounded-full px-0.5 text-brand-200">✕</span>
                </button>
              ))}
              <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-xs text-muted-foreground underline">
                clear all
              </button>
            </div>
          )}
          <Section title="Date range" accent={ACCENTS.date} count={value.dateRange ? 1 : 0}>
            <div className="space-y-1.5">
              <label className="block">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">From</span>
                <input
                  type="month"
                  aria-label="From month"
                  value={value.dateRange ? `${value.dateRange.fromYear}-${String(value.dateRange.fromMonth).padStart(2, "0")}` : ""}
                  onChange={(e) => {
                    if (!e.target.value) return onChange({ ...value, dateRange: null });
                    const [y, m] = e.target.value.split("-").map(Number);
                    const dr = value.dateRange ?? { fromYear: y, fromMonth: m, toYear: 2100, toMonth: 12 };
                    onChange({ ...value, dateRange: { ...dr, fromYear: y, fromMonth: m } });
                  }}
                  className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">To</span>
                <input
                  type="month"
                  aria-label="To month"
                  value={value.dateRange && value.dateRange.toYear < 2100 ? `${value.dateRange.toYear}-${String(value.dateRange.toMonth).padStart(2, "0")}` : ""}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m] = e.target.value.split("-").map(Number);
                    const dr = value.dateRange ?? { fromYear: 2000, fromMonth: 1, toYear: y, toMonth: m };
                    onChange({ ...value, dateRange: { ...dr, toYear: y, toMonth: m } });
                  }}
                  className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
                />
              </label>
            </div>
          </Section>

          <Section title="Waves" accent={ACCENTS.waves} count={value.waveIds.length}>
            <div className="flex flex-wrap gap-1.5">
              {options.waves.map((w) => (
                <Chip
                  key={w.id}
                  label={w.label.replace("Wave ", "W")}
                  selected={value.waveIds.includes(w.id)}
                  onToggle={() => onChange({ ...value, waveIds: toggle(value.waveIds, w.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Segments" accent={ACCENTS.segments} count={value.segmentIds.length}>
            <div className="flex flex-wrap gap-1.5">
              {options.segments.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={value.segmentIds.includes(s.id)}
                  onToggle={() => onChange({ ...value, segmentIds: toggle(value.segmentIds, s.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Themes" accent={ACCENTS.themes} count={value.themeIds.length}>
            <div className="flex flex-wrap gap-1.5">
              {options.themes.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  selected={value.themeIds.includes(t.id)}
                  onToggle={() => onChange({ ...value, themeIds: toggle(value.themeIds, t.id) })}
                />
              ))}
            </div>
          </Section>

          <Section title="Source types" accent={ACCENTS.sources} count={value.sourceTypes.length}>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_TYPES.map((s) => (
                <Chip
                  key={s}
                  label={s.replace(/_/g, " ")}
                  selected={value.sourceTypes.includes(s)}
                  onToggle={() => onChange({ ...value, sourceTypes: toggle(value.sourceTypes, s) })}
                />
              ))}
            </div>
          </Section>

          {showEvidenceTypes && (
            <Section title="Evidence" accent={ACCENTS.evidence} count={value.evidenceTypes.length}>
              <div className="flex flex-wrap gap-1.5">
                {EVIDENCE_TYPES.map((s) => (
                  <Chip
                    key={s}
                    label={s.replace(/_/g, " ")}
                    selected={value.evidenceTypes.includes(s)}
                    onToggle={() => onChange({ ...value, evidenceTypes: toggle(value.evidenceTypes, s) })}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Sentiment" accent={ACCENTS.sentiment} count={value.sentiments.length}>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENTS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={value.sentiments.includes(s)}
                  onToggle={() => onChange({ ...value, sentiments: toggle(value.sentiments, s) })}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">AI-assessed tone — indicative only.</p>
          </Section>
        </CardContent>
      </Card>
    </aside>
  );
}
