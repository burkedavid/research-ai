"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  wave: string;
  themeName: string;
  chunkCount: number;
}

// the Sentiment Research mark's palette, deepened for legibility on white
const COLORS = ["#0091d4", "#e0761f", "#16a34a", "#d327a8", "#7c4fd8", "#0d9488", "#b45309", "#334155"];

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
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="wave" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: "tagged passages", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {topThemes.map((theme, i) => (
            <Line key={theme} type="monotone" dataKey={theme} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-400">
        Counts are tagged passages in a small qualitative sample — an indication of discussion volume, not statistical prevalence.
      </p>
    </div>
  );
}
