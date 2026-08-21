import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { segments, themes, waves } from "@/db/schema";
import { REGIONS } from "@/lib/seed/segments";

export interface FilterOptions {
  waves: { id: string; label: string }[];
  segments: { id: string; name: string }[];
  themes: { id: string; name: string }[];
  regions: string[];
}

/** Shared filter-sidebar options for /ask, /quotes, /compare, /segments. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [waveRows, segmentRows, themeRows, regionRows] = await Promise.all([
    db.select().from(waves).orderBy(desc(waves.year), desc(waves.month)),
    db.select().from(segments).orderBy(segments.name),
    db.select().from(themes).where(eq(themes.status, "active")).orderBy(themes.name),
    // regions actually present in the data — a hardcoded list would hide any
    // region the reports use that the parser wasn't expecting
    db.execute(sql`SELECT DISTINCT region FROM chunks WHERE region IS NOT NULL ORDER BY region`) as unknown as Promise<
      { region: string }[]
    >,
  ]);

  const present = regionRows.map((r) => r.region);
  // keep the canonical order for known regions, then append any extras found
  const known = REGIONS.filter((r) => present.includes(r));
  const extra = present.filter((r) => !REGIONS.includes(r as (typeof REGIONS)[number])).sort();

  return {
    waves: waveRows.map((w) => ({
      id: w.id,
      label: `Wave ${w.waveNumber} — ${w.year}-${String(w.month).padStart(2, "0")}`,
    })),
    segments: segmentRows.map((s) => ({ id: s.id, name: s.name })),
    themes: themeRows.map((t) => ({ id: t.id, name: t.name })),
    // fall back to the canonical list before anything is ingested
    regions: present.length ? [...known, ...extra] : [...REGIONS],
  };
}
