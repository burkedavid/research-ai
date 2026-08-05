import Link from "next/link";
import { sql } from "drizzle-orm";
import { NavIcon, type IconName } from "@/components/nav-icons";
import { db } from "@/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ACTIONS: { href: string; title: string; desc: string; icon: IconName; iconWrap: string }[] = [
  { href: "/ask", title: "Ask the Archive", desc: "Natural-language questions with cited, evidence-based answers", icon: "ask", iconWrap: "bg-sr-orange/10 text-orange-600" },
  { href: "/trends", title: "Trends", desc: "How themes and language move across the whole archive", icon: "trends", iconWrap: "bg-sr-blue/10 text-sky-600" },
  { href: "/compare", title: "Compare Periods", desc: "Any two waves, months or segments, side by side", icon: "compare", iconWrap: "bg-sr-yellow/10 text-amber-600" },
  { href: "/quotes", title: "Find Quotes", desc: "Retrieve, shortlist and export direct consumer verbatim", icon: "quotes", iconWrap: "bg-sr-cyan/10 text-teal-600" },
  { href: "/segments", title: "Explore Segments", desc: "Fresco segment profiles — themes, language and voice", icon: "segments", iconWrap: "bg-sr-green/10 text-green-600" },
  { href: "/reports", title: "Create Report", desc: "Grounded first drafts and deep-research briefings", icon: "reports", iconWrap: "bg-sr-purple/10 text-purple-600" },
];

function timeAgo(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}

async function getDashboard(userId: string) {
  const [stats] = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM waves) AS waves,
      (SELECT count(*)::int FROM documents WHERE status = 'indexed') AS documents,
      (SELECT count(*)::int FROM documents WHERE status = 'indexed' AND created_at >= date_trunc('month', now())) AS documents_this_month,
      (SELECT count(*)::int FROM chunks c JOIN documents d ON d.id = c.document_id
        WHERE d.status = 'indexed' AND c.evidence_type = 'direct_quote') AS quotes,
      (SELECT count(*)::int FROM interviews) AS interviews,
      (SELECT min(year) FROM waves) AS from_year,
      (SELECT max(year) FROM waves) AS to_year
  `)) as unknown as {
    waves: number; documents: number; documents_this_month: number; quotes: number; interviews: number; from_year: number | null; to_year: number | null;
  }[];

  const latestDocs = (await db.execute(sql`
    SELECT d.id, d.filename, d.source_type, d.created_at,
           w.year || '-' || lpad(w.month::text, 2, '0') AS wave
    FROM documents d JOIN waves w ON w.id = d.wave_id
    WHERE d.status = 'indexed'
    ORDER BY d.created_at DESC
    LIMIT 5
  `)) as unknown as { id: string; filename: string; source_type: string; created_at: Date; wave: string }[];

  const themes = (await db.execute(sql`
    SELECT t.name, count(DISTINCT c.id)::int AS n
    FROM chunk_themes ct
    JOIN chunks c ON c.id = ct.chunk_id
    JOIN documents d ON d.id = c.document_id
    JOIN themes t ON t.id = ct.theme_id
    WHERE d.status = 'indexed' AND t.status = 'active'
    GROUP BY t.name
    ORDER BY n DESC
    LIMIT 6
  `)) as unknown as { name: string; n: number }[];

  const recentSearches = (await db.execute(sql`
    SELECT title, created_at FROM conversations
    WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 4
  `)) as unknown as { title: string; created_at: Date }[];

  return { stats, latestDocs, themes, recentSearches };
}

export default async function HomePage() {
  const user = await requireUser();
  const { stats, latestDocs, themes, recentSearches } = await getDashboard(user.id);
  const span =
    stats.from_year && stats.to_year && stats.from_year !== stats.to_year ? `${stats.from_year}–${stats.to_year}` : (stats.from_year ?? "—");
  const maxTheme = themes[0]?.n ?? 1;
  const firstName = user.name.split(" ")[0];

  const METRICS = [
    { value: String(stats.documents), label: "Documents", note: stats.documents_this_month > 0 ? `+${stats.documents_this_month} this month` : `across ${stats.waves} waves` },
    { value: String(stats.interviews), label: "Interviews", note: `across ${stats.waves} waves` },
    { value: String(stats.quotes), label: "Verbatim passages", note: "ready to cite & export" },
    { value: String(span), label: "Archive span", note: `${stats.waves} research waves` },
  ];

  return (
    <div className="min-w-0">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_15%_-10%,rgba(255,129,85,0.10),transparent),radial-gradient(50rem_28rem_at_95%_-20%,rgba(154,108,240,0.12),transparent)]" />
        <div className="relative px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8">
          <p className="text-sm font-medium text-brand-600">Welcome back, {firstName}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-brand-900 sm:text-[2.6rem]">
            Consumer Sentiment Intelligence Hub
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Six years of qualitative consumer research — searchable, cited and traceable to every voice. Ask a question,
            trace a theme over time, or pull the verbatim behind it.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/ask" className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700">
              <NavIcon name="ask" className="size-4" /> Ask the Archive
            </Link>
            <Link href="/trends" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-brand-600 hover:text-brand-900">
              <NavIcon name="trends" className="size-4" /> See what&apos;s trending
            </Link>
          </div>

          {/* Metrics */}
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:mt-9 sm:grid-cols-4 sm:gap-x-10">
            {METRICS.map((m) => (
              <div key={m.label}>
                <p className="text-2xl font-semibold tracking-tight text-brand-900 sm:text-3xl">{m.value}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        {/* Main: workflows */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-brand-900">Explore the archive</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}>
                  <NavIcon name={a.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-brand-900">
                    {a.title}
                    <span className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden>→</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>

          {recentSearches.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-brand-900">Jump back in</h2>
              <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
                {recentSearches.map((s, i) => (
                  <Link key={i} href="/ask" className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-50/50">
                    <NavIcon name="ask" className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(new Date(s.created_at))}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aside: trending + latest */}
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">Trending themes</h2>
            <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
              {themes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No themes indexed yet.</p>
              ) : (
                themes.map((t) => (
                  <Link key={t.name} href="/trends" className="group block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2 text-foreground group-hover:text-brand-900">{t.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.n}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-900" style={{ width: `${Math.max(8, (t.n / maxTheme) * 100)}%` }} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-brand-900">Latest research</h2>
            <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {latestDocs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nothing indexed yet.</p>
              ) : (
                latestDocs.map((d) => (
                  <Link key={d.id} href={`/library/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-50/50">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <NavIcon name="reports" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{d.filename}</span>
                      <span className="block text-xs text-muted-foreground">{d.source_type.replace(/_/g, " ")} · {d.wave}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(new Date(d.created_at))}</span>
                  </Link>
                ))
              )}
            </div>
            <Link href="/library" className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
              View all in Library →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
