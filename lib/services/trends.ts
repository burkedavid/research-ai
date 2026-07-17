import { sql } from "drizzle-orm";
import { db } from "@/db";
import { waves } from "@/db/schema";
import type { SessionUser } from "@/lib/errors";
import { comparePeriods, type CompareResult } from "./compare";

export interface TrendPoint {
  wave: string;
  themeName: string;
  chunkCount: number;
}

export type Movement = "new" | "growing" | "continuing" | "fading";

export interface ThemeMover {
  themeName: string;
  earliestCount: number;
  latestCount: number;
  movement: Movement;
}

export interface TrendData {
  points: TrendPoint[];
  movers: ThemeMover[];
  earliest: { id: string; label: string } | null;
  latest: { id: string; label: string } | null;
}

function label(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Archive-wide theme trajectories across every wave (F5). ACL-aware: without
 * transcript access, transcript-sourced chunks are excluded — the same rule the
 * retrieval layer enforces. This is the clustering/trajectory data behind the
 * Trends view; the narrative synthesis is generated separately on demand.
 */
export async function getTrendData(user: SessionUser): Promise<TrendData> {
  const waveRows = await db
    .select({ id: waves.id, year: waves.year, month: waves.month })
    .from(waves)
    .orderBy(waves.year, waves.month);
  if (waveRows.length === 0) return { points: [], movers: [], earliest: null, latest: null };

  const points = (await db.execute(sql`
    SELECT w.year || '-' || lpad(w.month::text, 2, '0') AS wave,
           t.name AS theme_name,
           count(DISTINCT c.id)::int AS chunk_count
    FROM chunk_themes ct
    JOIN chunks c ON c.id = ct.chunk_id
    JOIN documents d ON d.id = c.document_id
    JOIN waves w ON w.id = c.wave_id
    JOIN themes t ON t.id = ct.theme_id
    WHERE d.status = 'indexed'
      ${user.transcriptAccess ? sql`` : sql`AND d.source_type <> 'transcript'`}
    GROUP BY w.year, w.month, t.name
    ORDER BY w.year, w.month
  `)) as unknown as { wave: string; theme_name: string; chunk_count: number }[];

  const first = waveRows[0];
  const last = waveRows[waveRows.length - 1];
  const firstLabel = label(first.year, first.month);
  const lastLabel = label(last.year, last.month);

  // per-theme earliest vs latest counts → movement classification
  const byTheme = new Map<string, { earliest: number; latest: number }>();
  for (const p of points) {
    const rec = byTheme.get(p.theme_name) ?? { earliest: 0, latest: 0 };
    if (p.wave === firstLabel) rec.earliest = Number(p.chunk_count);
    if (p.wave === lastLabel) rec.latest = Number(p.chunk_count);
    byTheme.set(p.theme_name, rec);
  }

  const movers: ThemeMover[] = [...byTheme.entries()]
    .map(([themeName, { earliest, latest }]) => {
      let movement: Movement;
      if (earliest === 0 && latest > 0) movement = "new";
      else if (latest > earliest) movement = "growing";
      else if (latest < earliest) movement = "fading";
      else movement = "continuing";
      return { themeName, earliestCount: earliest, latestCount: latest, movement };
    })
    .sort((a, b) => Math.abs(b.latestCount - b.earliestCount) - Math.abs(a.latestCount - a.earliestCount));

  return {
    points: points.map((p) => ({ wave: p.wave, themeName: p.theme_name, chunkCount: Number(p.chunk_count) })),
    movers,
    earliest: waveRows.length > 1 ? { id: first.id, label: firstLabel } : null,
    latest: waveRows.length > 1 ? { id: last.id, label: lastLabel } : null,
  };
}

/**
 * Cross-wave AI narrative synthesis (F5): reuses the comparison engine to
 * contrast the earliest and latest waves across the whole archive with the
 * new/growing/continuing/fading framing — cited, cautious, verified.
 */
export async function synthesiseTrends(user: SessionUser, ip?: string | null): Promise<CompareResult | null> {
  const trend = await getTrendData(user);
  if (!trend.earliest || !trend.latest) return null;
  return comparePeriods({
    user,
    question:
      "Across the whole archive, which consumer themes are new, growing, continuing or fading? Summarise the biggest shifts in consumer sentiment over time.",
    labelA: trend.earliest.label,
    filtersA: { waveIds: [trend.earliest.id] },
    labelB: trend.latest.label,
    filtersB: { waveIds: [trend.latest.id] },
    ip,
  });
}

