"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  wave: string;
  themeName: string;
  chunkCount: number;
}

// the Sentiment Research mark's palette, deepened for legibility on white
const COLORS = ["#0091d4", "#e0761f", "#16a34a", "#d327a8", "#7c4fd8", "#0d9488", "#b45309", "#334155"];

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
}

/**
 * Compact tooltip. Recharts' default renders one unstyled line per series —
 * with eight themes that is taller than a phone chart and spills over the
 * legend, which is exactly what it did on iPhone. This caps the width, sorts
 * by value so the themes that matter are at the top, and shows only the
 * non-zero series.
 */
function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => Number(p.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 6);
  if (rows.length === 0) return null;

  return (
    <div className="max-w-[15rem] rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-medium text-brand-900">{label}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={String(r.name)} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-600">{r.name}</span>
            <span className="shrink-0 font-medium tabular-nums text-brand-900">{r.value}</span>
          </li>
        ))}
      </ul>
      {payload.filter((p) => Number(p.value) > 0).length > rows.length && (
        <p className="mt-1 text-[10px] text-slate-400">+ smaller themes not shown</p>
      )}
    </div>
  );
}

/** Theme-frequency timeline (§A9 keyword trackers / trend timelines, v1). */
export function ThemeTimeline({ points, maxThemes = 6 }: { points: Point[]; maxThemes?: number }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400">No indexed evidence yet for a timeline.</p>;
  }

  const totals = new Map<string, number>();
  for (const p of points) totals.set(p.themeName, (totals.get(p.themeName) ?? 0) + p.chunkCount);
  const topThemes = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxThemes)
    .map(([name]) => name);

  const wavesInOrder = [...new Set(points.map((p) => p.wave))].sort();
  const data = wavesInOrder.map((wave) => {
    const row: Record<string, string | number> = { wave };
    for (const theme of topThemes) {
      row[theme] = points.find((p) => p.wave === wave && p.themeName === theme)?.chunkCount ?? 0;
    }
    return row;
  });

  return (
    <div className="w-full">
      {/* The chart owns its own box. The legend and caption sit outside it —
          when they lived inside the fixed height they overlapped the plot. */}
      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="wave" tick={{ fontSize: 11 }} minTickGap={16} />
            <YAxis
              allowDecimals={false}
              width={34}
              tick={{ fontSize: 11 }}
              label={{ value: "passages", angle: -90, position: "insideLeft", style: { fontSize: 10 } }}
            />
            <Tooltip content={<TimelineTooltip />} wrapperStyle={{ outline: "none" }} />
            {topThemes.map((theme, i) => (
              <Line
                key={theme}
                type="monotone"
                dataKey={theme}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Own legend rather than recharts': it wraps predictably and cannot be
          overlapped by the tooltip. */}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {topThemes.map((theme, i) => (
          <li key={theme} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            {theme}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400">
        Counts are tagged passages in a small qualitative sample — an indication of discussion volume, not statistical
        prevalence. Tap or hover a point to see that wave&apos;s figures.
      </p>
    </div>
  );
}
