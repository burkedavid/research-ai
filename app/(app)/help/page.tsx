import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help — Consumer Sentiment Hub" };

const EXAMPLE_QUESTIONS = [
  "How have Rising Metropolitans talked about optimism since March 2020?",
  "What were the biggest concerns among Budgeting Elderly consumers during the energy crisis?",
  "Compare attitudes to banks before and after Covid",
  "What words do consumers use most when talking about money worries?",
  "Which segments talk most about fairness, trust, anxiety, control or resilience?",
  "Pull verbatim from all waves where consumers mention cutting back",
];

const TINTS = [
  "border-sr-orange/40 bg-sr-orange/10 text-orange-900 hover:bg-sr-orange/20",
  "border-sr-green/40 bg-sr-green/10 text-green-900 hover:bg-sr-green/20",
  "border-sr-blue/40 bg-sr-blue/10 text-sky-900 hover:bg-sr-blue/20",
  "border-sr-purple/40 bg-sr-purple/10 text-purple-900 hover:bg-sr-purple/20",
  "border-sr-magenta/40 bg-sr-magenta/10 text-pink-900 hover:bg-sr-magenta/20",
  "border-sr-cyan/40 bg-sr-cyan/10 text-teal-900 hover:bg-sr-cyan/20",
];

const QUICKSTART = [
  { n: 1, accent: "bg-sr-orange", title: "Ask a question", text: "Open Ask the Archive and type a question the way you'd ask a colleague. Scope it with the filters if you want a specific period, segment or theme." },
  { n: 2, accent: "bg-sr-yellow", title: "Check the evidence", text: "Read the confidence banner, click a [1] citation to see the exact source passage, and open “why these results” if you want to see how retrieval chose them." },
  { n: 3, accent: "bg-sr-green", title: "Collect verbatim", text: "Use Find Quotes for word-for-word consumer voice. Shortlist the strong ones and copy or export them with their source references attached." },
  { n: 4, accent: "bg-sr-blue", title: "Draft and export", text: "Use Create Report for a grounded first draft, edit every section, then export to Word with the citations appendix included." },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Why does my upload sit in “review”?",
    a: "Deliberately. Nothing becomes searchable until a person has checked the extraction — correct speaker roles, segments and themes, and resolve any flagged personal data. Approve the document and it is indexed within moments.",
  },
  {
    q: "Why can't I see any quotes?",
    a: "Direct verbatim comes from raw transcripts, which need the separate transcript-access permission. If Find Quotes says your account can't access transcripts, ask an administrator.",
  },
  {
    q: "Why does an answer say “treat with caution”?",
    a: "The confidence statement is computed from the retrieved evidence itself: how many interviews, waves and source types support the answer. A caution banner means a thin base — usually one interview or one wave — so treat the finding as indicative.",
  },
  {
    q: "Why is a quote flagged red?",
    a: "Every quoted span is machine-checked, word for word, against its cited source chunk. A red flag means the words in the answer don't exactly match the source — never use a flagged quote in client work.",
  },
  {
    q: "Why won't my wave confirm?",
    a: "Every document in the wave must be reviewed first — approved (indexed) or rejected. The confirm button stays disabled while anything is still awaiting review.",
  },
  {
    q: "I uploaded the wrong file — is anything lost?",
    a: "No. Identical re-uploads are refused, and a corrected file with the same name becomes version 2, with version 1 preserved. Deleting a document (admins only) removes its file, text and search index completely, and is recorded in the audit log.",
  },
  {
    q: "Why do answers never give percentages?",
    a: "Qualitative samples are small by design. The system is required to use cautious research language — many, several, a few — and to never dress up counts as statistical prevalence. That's a feature of the evidence standards, not a limitation.",
  },
];

const GLOSSARY = [
  ["Wave", "One month's fieldwork. Reports of any cadence within a month share a wave; each report keeps its own day-level date."],
  ["Report date", "The fieldwork date read automatically from the filename (e.g. 01.07.26). Drives which wave a bulk-uploaded report is filed under, and date-range filtering."],
  ["Segment", "One of the twelve Fresco consumer segments (e.g. Road to Retirement). Report quotes attributed as (Segment, Region) are tagged to their segment."],
  ["Region", "The consumer's region (North, South, Midlands, Scotland, Wales, London…), read from report attributions and available as a filter."],
  ["Theme", "A topic from the controlled taxonomy (e.g. Energy and fuel). Admins can add, define and merge themes; the ingest AI proposes new ones."],
  ["Verbatim / direct quote", "A consumer's exact words — from a transcript, or attributed inline in a report — never paraphrased, always machine-verified."],
  ["Researcher summary", "Findings written by researchers in reports — agreed interpretation, distinct from consumer voice."],
  ["Sentiment", "The ingest AI's assessment of a passage's tone (positive/negative/neutral/mixed). Indicative only, filterable."],
  ["Evidential basis", "The narrative confidence statement computed from how much evidence supports an answer."],
  ["Citation [1]", "A numbered link from a claim to the exact source passage it came from."],
  ["Review gate", "The human check every uploaded document passes before it becomes searchable."],
];

function SectionCard({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden pt-0">
      <div className={`h-1 w-full ${accent}`} />
      <CardHeader className="pt-5">
        <CardTitle className="text-brand-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-700">{children}</CardContent>
    </Card>
  );
}

export default async function HelpPage() {
  const user = await requireUser();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Help & how-to" subtitle="A researcher's guide to the Consumer Sentiment Intelligence Hub." />

      {/* quick start stepper */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUICKSTART.map((s) => (
          <Card key={s.n} className="overflow-hidden pt-0">
            <div className={`h-1 w-full ${s.accent}`} />
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold text-white ${s.accent === "bg-sr-yellow" ? "bg-sr-yellow text-brand-900" : s.accent}`}>
                  {s.n}
                </span>
                <p className="font-medium text-brand-900">{s.title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{s.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* try it now — deep-linked questions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-900">Try it now</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Click any question to run it in Ask the Archive:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q, i) => (
              <Link
                key={q}
                href={`/ask?q=${encodeURIComponent(q)}`}
                className={`rounded-full border px-3 py-1.5 text-xs transition hover:shadow-sm ${TINTS[i % TINTS.length]}`}
              >
                {q}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: combine a question with the sidebar filters — one segment plus a date range gives sharper,
            better-evidenced answers than a broad question.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard accent="bg-sr-orange" title="What each area is for">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/ask" className="font-medium underline">Ask the Archive</Link> — natural-language questions
              with cited, evidence-based answers.
            </li>
            <li>
              <Link href="/compare" className="font-medium underline">Compare Periods</Link> — any two waves, date
              ranges or segments, framed as <em>new, growing, continuing and fading</em>.
            </li>
            <li>
              <Link href="/trends" className="font-medium underline">Trends</Link> — how themes move across the whole
              archive (new / growing / continuing / fading), with a chart and an AI cross-wave synthesis.
            </li>
            <li>
              <Link href="/segments" className="font-medium underline">Explore Segments</Link> — per-segment themes,
              consumer language, trends and recent verbatim.
            </li>
            <li>
              <Link href="/quotes" className="font-medium underline">Find Quotes</Link> — word-for-word consumer
              voice with shortlisting and referenced export.
            </li>
            <li>
              <Link href="/library/outputs" className="font-medium underline">Saved outputs</Link> — save answers,
              comparisons, quote lists and report drafts, and create a <em>read-only share link</em> so a stakeholder
              can view one without logging in (revoke it any time).
            </li>
            <li>
              <Link href="/reports" className="font-medium underline">Create Report</Link> — grounded first drafts
              (monthly summary, theme deep dive, what-has-changed) with Word export.
            </li>
            <li>
              <Link href="/library" className="font-medium underline">Library</Link> — waves, uploads, the review
              queue, source documents and your saved outputs.
            </li>
          </ul>
        </SectionCard>

        <SectionCard accent="bg-sr-yellow" title="Loading reports & the wave workflow">
          <p>
            Two ways to add material. For a single month, create the wave (month, year, wave number, key events) and
            upload into it. For a back-catalogue, use <strong>Bulk upload reports (auto-date)</strong> — pick a project,
            drop in many files at once, and each is filed under the wave for its own month, read from the date in the
            filename (e.g. <em>…01.07.26…</em> → July 2026). Files whose name has no readable date are flagged so you can
            rename or file them by hand. The report&apos;s exact day-level date is kept, so twice-weekly early reports
            stay distinct even when they share a month.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Upload your files — Word reports, PowerPoint debriefs, transcripts (.txt/.vtt/.docx), crib sheets,
              Excel/CSV. The <em>source type</em> you pick controls how each file is read. Report headings (whether
              styled or just bold) are detected so each section is searchable on its own.
            </li>
            <li>
              <strong>Review each document.</strong> Check the extracted passages against the original, fix speaker
              roles, segments and themes, and accept or dismiss flagged personal data. The ingest AI pre-suggests
              theme tags — accept them individually or use <em>Accept AI tags</em> to confirm them all at once. If it
              spots a recurring topic outside the taxonomy it proposes a new theme for an admin to add. Redactions
              change the searchable text; the original file is kept untouched but access-restricted.
            </li>
            <li>Approve each document to index it, then confirm the wave.</li>
            <li>Run a what-has-changed report, or open Trends for the whole archive.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Duplicates are refused automatically; a changed file with the same name becomes a new version — nothing is
            ever silently overwritten.
          </p>
        </SectionCard>

        <SectionCard accent="bg-sr-orange" title="Segments, regions & quotes in reports">
          <p>
            Consumers are grouped into the twelve Fresco segments (Still at Home, Starting Out, Rising Metropolitans,
            Constrained Parents, Working Singles &amp; Couples, Home-Owning Families, High Income Professionals, Older
            Working Families, Mid-Life Renters, Asset Rich Greys, Road to Retirement, Budgeting Elderly).
          </p>
          <p>
            Where a report quotes a consumer and attributes it inline as <em>(Segment, Region)</em> — for example
            &ldquo;…(Road to Retirement, North)&rdquo; — that verbatim is captured as a direct quote tagged with its
            segment and region. So even with reports only and no transcripts, those quotes appear in{" "}
            <Link href="/quotes" className="font-medium underline">Find Quotes</Link> and can be filtered by
            <strong> region</strong> (North, South, Midlands, Scotland, Wales, London…) alongside segment, theme and
            date.
          </p>
        </SectionCard>

        <SectionCard accent="bg-sr-green" title="Reading the answers">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Citations like [1]</strong> link every claim to a source passage — click to open the exact chunk
              in the document viewer.
            </li>
            <li>
              <strong>The confidence banner</strong> (&ldquo;High confidence: supported by 24 interviews across 11
              waves…&rdquo;) is computed from the retrieved evidence, not the AI&apos;s opinion — and is deliberately
              never a percentage.
            </li>
            <li>
              <strong>&ldquo;Why these results&rdquo;</strong> shows how each passage was found — semantic match,
              keyword match or both, its fusion score, and its final <em>ranked</em> score after re-ranking (which
              favours a spread of interviews and recency across the results you are permitted to see).
            </li>
            <li>
              <strong>Quote verification</strong> — quoted spans are machine-checked against their sources; a red flag
              means the quote could not be verified word-for-word.
            </li>
            <li>
              <strong>Weak evidence warnings</strong> mean the archive had little to say — widen the filters or treat
              the answer as indicative.
            </li>
            <li>
              <strong>Sentiment badges</strong> on quotes and passages show the ingest AI&apos;s assessment of tone
              (positive / negative / neutral / mixed) and can be filtered on. It is indicative only — never read it as
              a statistical measure of how many consumers feel a certain way.
            </li>
          </ul>
        </SectionCard>

        <SectionCard accent="bg-sr-cyan" title="Evidence standards (why answers sound cautious)">
          <p>
            This is qualitative research from small samples. The system is required to use cautious language — many,
            several, a few, appears, there is a sense — and to flag small bases explicitly. Counts describe how often
            something was discussed, never statistical prevalence. Contradictory and minority views stay visible, and
            researcher summaries are always distinguished from direct consumer quotes.
          </p>
          <p>AI-generated drafts are exactly that — drafts. Review and edit before anything reaches a client.</p>
        </SectionCard>
      </div>

      {/* FAQ */}
      <Card className="mt-6 overflow-hidden pt-0">
        <div className="h-1 w-full bg-sr-blue" />
        <CardHeader className="pt-5">
          <CardTitle className="text-brand-900">Common questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/60">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-2.5">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-foreground">
                  {item.q}
                  <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-90">›</span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* roles matrix */}
        <Card className="overflow-hidden pt-0">
          <div className="h-1 w-full bg-sr-magenta" />
          <CardHeader className="pt-5">
            <CardTitle className="text-brand-900">Who can do what</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  <TableHead>Viewer</TableHead>
                  <TableHead>Researcher</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Search, read answers and reports", "✓", "✓", "✓"],
                  ["See raw transcripts and quotes*", "—", "✓*", "✓*"],
                  ["Upload, review and approve documents", "—", "✓", "✓"],
                  ["Generate and export reports", "—", "✓", "✓"],
                  ["Manage users, themes and retention", "—", "—", "✓"],
                  ["Delete documents / view audit log", "—", "—", "✓"],
                ].map(([cap, v, r, a]) => (
                  <TableRow key={cap}>
                    <TableCell className="text-muted-foreground">{cap}</TableCell>
                    <TableCell>{v}</TableCell>
                    <TableCell>{r}</TableCell>
                    <TableCell>{a}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              *Transcript access is a separate permission on top of the role. You are signed in as {user.name} (
              {user.role}
              {user.transcriptAccess ? ", with transcript access" : ", without transcript access"}). All activity —
              searches, source views, exports — is audited.
            </p>
          </CardContent>
        </Card>

        {/* glossary */}
        <Card className="overflow-hidden pt-0">
          <div className="h-1 w-full bg-sr-purple" />
          <CardHeader className="pt-5">
            <CardTitle className="text-brand-900">Glossary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5">
              {GLOSSARY.map(([term, def]) => (
                <div key={term}>
                  <dt className="text-sm font-medium text-foreground">{term}</dt>
                  <dd className="text-sm leading-5 text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
