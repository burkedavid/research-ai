import Link from "next/link";
import { sql } from "drizzle-orm";
import { NavIcon, type IconName } from "@/components/nav-icons";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";

export const dynamic = "force-dynamic";

const ACTIONS: { href: string; title: string; desc: string; accent: string; icon: IconName; iconWrap: string }[] = [
  { href: "/ask", title: "Ask the Archive", desc: "Natural language questions with evidence-based, cited answers", accent: "bg-sr-orange", icon: "ask", iconWrap: "bg-sr-orange/10 text-orange-600" },
  { href: "/compare", title: "Compare Time Periods", desc: "Compare months, years or custom periods", accent: "bg-sr-yellow", icon: "compare", iconWrap: "bg-sr-yellow/10 text-amber-600" },
  { href: "/segments", title: "Explore Segments", desc: "Fresco segment profiles and trends", accent: "bg-sr-green", icon: "segments", iconWrap: "bg-sr-green/10 text-green-600" },
  { href: "/quotes", title: "Find Quotes", desc: "Retrieve, shortlist and export direct verbatim", accent: "bg-sr-cyan", icon: "quotes", iconWrap: "bg-sr-cyan/10 text-teal-600" },
  { href: "/reports", title: "Create Report", desc: "Generate summaries, reports and presentation content", accent: "bg-sr-blue", icon: "reports", iconWrap: "bg-sr-blue/10 text-sky-600" },
  { href: "/library", title: "Library", desc: "Waves, documents, upload and review queue", accent: "bg-sr-purple", icon: "library", iconWrap: "bg-sr-purple/10 text-purple-600" },
];

async function getArchiveStats() {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM waves) AS waves,
      (SELECT count(*)::int FROM documents WHERE status = 'indexed') AS documents,
      (SELECT count(*)::int FROM chunks c JOIN documents d ON d.id = c.document_id
        WHERE d.status = 'indexed' AND c.evidence_type = 'direct_quote') AS quotes,
      (SELECT count(*)::int FROM interviews) AS interviews,
      (SELECT min(year) FROM waves) AS from_year,
      (SELECT max(year) FROM waves) AS to_year
  `)) as unknown as {
    waves: number;
    documents: number;
    quotes: number;
    interviews: number;
    from_year: number | null;
    to_year: number | null;
  }[];
  return row;
}

export default async function HomePage() {
  const stats = await getArchiveStats();
  const span =
    stats.from_year && stats.to_year && stats.from_year !== stats.to_year
      ? `${stats.from_year}–${stats.to_year}`
      : (stats.from_year ?? "—");

  const STATS = [
    { label: "Research waves", value: stats.waves },
    { label: "Indexed documents", value: stats.documents },
    { label: "Consumer interviews", value: stats.interviews },
    { label: "Verbatim passages", value: stats.quotes },
    { label: "Archive span", value: span },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="py-6">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-900">
          Consumer Sentiment Intelligence Hub
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sentiment Research — in the business of getting to know people. A longitudinal archive of qualitative
          consumer research, searchable with full source traceability.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map((s) => (
          <Card key={s.label} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-2xl text-brand-900">{s.value}</CardTitle>
              <CardDescription className="text-xs">{s.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="group">
            <Card className="h-full overflow-hidden pt-0 transition group-hover:border-brand-600 group-hover:shadow-md">
              <div className={`h-1 w-full ${a.accent}`} />
              <CardHeader className="pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${a.iconWrap}`}>
                    <NavIcon name={a.icon} className="size-5" />
                  </span>
                  <span className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden>
                    →
                  </span>
                </div>
                <CardTitle className="text-brand-900">{a.title}</CardTitle>
                <CardDescription className="leading-5">{a.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
