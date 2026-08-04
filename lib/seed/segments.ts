/**
 * The real Sentiment Research consumer segments used across the report archive
 * (item 3). Seeded as reference data so that quotes attributed inline in the
 * reports as "(Segment, Region)" resolve to a segment. The synthetic test
 * corpus keeps its own overlapping set in lib/seed/corpus.ts.
 */
export const REAL_SEGMENTS = [
  { name: "Still at Home", description: "Younger adults still living in the family home" },
  { name: "Starting Out", description: "Early-career, often renting, building independence" },
  { name: "Rising Metropolitans", description: "Younger urban professionals, higher incomes, digitally confident" },
  { name: "Constrained Parents", description: "Parents squeezed by childcare and household costs" },
  { name: "Working Singles & Couples", description: "Working-age singles and couples without children" },
  { name: "Home-Owning Families", description: "Families with a mortgage and school-age children" },
  { name: "High Income Professionals", description: "Higher earners, financially comfortable, career-focused" },
  { name: "Older Working Families", description: "Established families later in their working lives" },
  { name: "Mid-Life Renters", description: "Mid-life households renting rather than owning" },
  { name: "Asset Rich Greys", description: "Older, asset-rich, mortgage-free, savings-backed" },
  { name: "Road to Retirement", description: "Approaching retirement, planning the transition" },
  { name: "Budgeting Elderly", description: "Retired, fixed incomes, careful planners, value-focused" },
] as const;

/** Region tags that appear in report attributions, e.g. "(Segment, North)". */
export const REGIONS = ["North", "South", "Midlands", "Scotland", "Wales", "London", "East", "West"] as const;

/** Normalise a segment name for tolerant matching, e.g. "Home Owning Families"
 *  in prose vs "Home-Owning Families" in the taxonomy. */
export function normaliseSegmentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REAL_BY_NORM = new Map(REAL_SEGMENTS.map((s) => [normaliseSegmentName(s.name), s.name]));

/** Resolve a loose segment string from report prose to a canonical name. */
export function matchSegmentName(loose: string): string | null {
  return REAL_BY_NORM.get(normaliseSegmentName(loose)) ?? null;
}

const REGION_SET = new Set(REGIONS.map((r) => r.toLowerCase()));
export function matchRegion(loose: string): string | null {
  const t = loose.trim();
  return REGION_SET.has(t.toLowerCase()) ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}
