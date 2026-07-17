import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { segments, themes, waves } from "@/db/schema";

export interface FilterOptions {
  waves: { id: string; label: string }[];
  segments: { id: string; name: string }[];
  themes: { id: string; name: string }[];
}

/** Shared filter-sidebar options for /ask, /quotes, /compare, /segments. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [waveRows, segmentRows, themeRows] = await Promise.all([
    db.select().from(waves).orderBy(desc(waves.year), desc(waves.month)),
    db.select().from(segments).orderBy(segments.name),
    db.select().from(themes).where(eq(themes.status, "active")).orderBy(themes.name),
  ]);
  return {
    waves: waveRows.map((w) => ({
      id: w.id,
      label: `Wave ${w.waveNumber} — ${w.year}-${String(w.month).padStart(2, "0")}`,
    })),
    segments: segmentRows.map((s) => ({ id: s.id, name: s.name })),
    themes: themeRows.map((t) => ({ id: t.id, name: t.name })),
  };
}
