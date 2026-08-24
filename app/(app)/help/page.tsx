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
  { n: 4, accent: "bg-sr-blue", title: "Draft and export", text: "Use Create Report for a grounded first draft — a template, or a deep-research briefing from your own question — edit every section, then export to Word with the citations appendix, or save and share it." },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Why does my upload sit in “review”?",
    a: "Deliberately. Nothing becomes searchable until a person has checked the extraction — correct speaker roles, segments and themes, and resolve any flagged personal data. Approve the document and it is indexed within moments.",
  },
  {
    q: "Can I see quotes without transcript access?",
    a: "Yes — verbatim that reports attribute inline as “(Segment, Region)” is available to everyone in Find Quotes, shown with the report's exact date. Raw interview transcript verbatim is the only thing that needs the separate transcript-access permission; ask an administrator if you need it.",
  },
  {
    q: "What's a deep-research briefing?",
    a: "In Create Report, pick “Deep-research briefing” and type a research question. The system runs several scoped retrievals — overview, main themes, segment and region differences, change over time, and supporting verbatim — and assembles one cited, editable draft you can export to Word or save and share.",
  },
  {
    q: "How do I find the most common words about a topic?",
    a: "On Trends, use the “Most common words & phrases” panel: choose a period and, optionally, a topic (e.g. “the economy”) to see the words and phrases consumers use most across reports in that window.",
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
    q: "Should I accept the AI tags before approving a document?",
    a: "Accept AI tags first, then Approve & index — and that is the only order available, since tags can only be accepted while the document is in review. But they do different jobs. Approving is what makes the document searchable. Accepting the tags does not switch them on: an AI-suggested theme tag already counts for filtering and Trends exactly like a confirmed one. Accepting records them as confirmed by a person, under your name, in the audit log. So read the chips before you click it — one click can certify forty tags as human-checked. Skipping it is harmless, and leaves them honestly labelled as unconfirmed AI output.",
  },
  {
    q: "My .docx was refused, but it opens fine in Word",
    a: "Then it is almost certainly not really a .docx. A .docx is a specific format, not just an extension: renaming an old .doc, an .rtf, or a page saved from a browser or email does not convert it. Word opens such files happily, which is why they look fine on your machine, but nothing can read them here. Open the file in Word and use File → Save As → Word Document (.docx), then upload the saved copy. The same applies to .pptx and .xlsx.",
  },
  {
    q: "A document says “failed” — what now?",
    a: "Nothing from it has been indexed. The wave page shows the reason and what to do about it. Fix the file and upload it again under the same name: it becomes the next version, and the failed copy stays on record. Note that a failed document does not stop you confirming the wave, so check the wave isn't quietly missing a report before you confirm it.",
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
    q: "Can I add ONS or other published statistics?",
    a: "Yes — upload with the source type “Third-party data / published stats” and record the publisher, licence and URL. It is stored as context only: it can never become a consumer quote, it is excluded from interview and wave counts, and every citation from it is badged “third-party data”. Check the licence allows use in a client-facing tool — Open Government Licence material is generally fine with attribution; most subscription research is not, even if you can read it free.",
  },
  {
    q: "How much is the AI costing, and can we spend less?",
    a: "Administration → Usage & cost shows total spend, this month, and which activity the money goes on — including embeddings, which are billed on every search as well as on ingestion. Admins can also switch the model used for answers or for ingestion tagging, with prices shown as you choose; models differ several-fold in price, so trialling a cheaper one on a real briefing is worthwhile.",
  },
  {
    q: "A segment shows no evidence — what's wrong?",
    a: "Check Administration → Segments. A segment reading “0 — unmatched” means your reports' (Segment, Region) attributions aren't matching that spelling. Either rename the segment to match the reports, or merge it into the one it duplicates.",
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
  ["Third-party data", "Published statistics or external reports uploaded as context. Never counted as consumer voice, never quotable as verbatim, always badged at the citation."],
  ["Audit log", "The insert-only record of every material action — sign-ins, uploads, approvals, searches, exports, permission changes."],
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
      <PageHeader icon="help" title="Help & how-to" subtitle="A researcher's guide to the Consumer Sentiment Intelligence Hub." />

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
        <SectionCard accent="bg-sr-magenta" title="What you can do — every question, and where">
          <p>
            Each capability the hub is built for, mapped to exactly where you do it. The examples are typed the way
            you&apos;d actually ask.
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">Swipe the table sideways to see the steps.</p>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">You want to…</TableHead>
                  <TableHead className="whitespace-nowrap">Where</TableHead>
                  <TableHead>How</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Search reports by theme or topic</TableCell>
                  <TableCell><Link href="/ask" className="underline">Ask the Archive</Link></TableCell>
                  <TableCell>Type the topic; narrow with the Theme, Segment, Region or Date filters.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Verbatim about a topic — <em>&ldquo;Show verbatim comments about COVID&rdquo;</em>, house buying, the economy, finances</TableCell>
                  <TableCell><Link href="/quotes" className="underline">Find Quotes</Link></TableCell>
                  <TableCell>Type the topic (e.g. <em>COVID</em>, <em>house buying</em>). Every result is word-for-word, tagged with segment, region and the report&apos;s date.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Most common words/phrases in a period — <em>&ldquo;…from Jan 2026 to July 2026 to describe the economy&rdquo;</em></TableCell>
                  <TableCell><Link href="/trends" className="underline">Trends</Link> → Most common words &amp; phrases</TableCell>
                  <TableCell>Set From Jan 2026, To Jul 2026, topic <em>the economy</em>, then Analyse.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Insights across different time periods</TableCell>
                  <TableCell><Link href="/ask" className="underline">Ask</Link> / <Link href="/trends" className="underline">Trends</Link></TableCell>
                  <TableCell>Ask with a Date-range filter, or read theme trajectories across every wave on Trends.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Compare trends &amp; language over time — <em>&ldquo;Compare discussion of the economy across different time periods&rdquo;</em></TableCell>
                  <TableCell><Link href="/compare" className="underline">Compare Periods</Link></TableCell>
                  <TableCell>Set Period A and Period B, ask about the economy; pair with the words &amp; phrases panel to compare the actual language.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>How people feel about a topic — <em>&ldquo;How are people feeling about finances?&rdquo;</em></TableCell>
                  <TableCell><Link href="/ask" className="underline">Ask the Archive</Link></TableCell>
                  <TableCell>Ask it directly; passages carry sentiment badges (positive/negative/neutral/mixed) and you can filter by sentiment.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Supporting verbatim for an insight — <em>&ldquo;Show the supporting verbatim for this insight&rdquo;</em></TableCell>
                  <TableCell>Any answer or report</TableCell>
                  <TableCell>Every claim carries a <strong>[1]</strong> citation — click it to open the exact source passage. Or search the theme in Find Quotes.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Store every report in one searchable place, no personal memory needed</TableCell>
                  <TableCell><Link href="/library" className="underline">Library</Link> + <Link href="/ask" className="underline">Ask</Link></TableCell>
                  <TableCell>All reports live in the Library and become searchable once approved; anyone can retrieve the insight later without remembering which report it was in.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>A full written briefing on a question</TableCell>
                  <TableCell><Link href="/reports" className="underline">Create Report</Link> → Deep-research briefing</TableCell>
                  <TableCell>Type the question; get a multi-section cited draft to edit, export to Word, or save and share.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </SectionCard>

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
              archive (new / growing / continuing / fading), with a chart, an AI cross-wave synthesis, and a{" "}
              <strong>most common words &amp; phrases</strong> panel for any period and topic.
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
              (monthly summary, theme deep dive, what-has-changed) plus a <strong>deep-research briefing</strong> from
              any free-text question, all with Word export.
            </li>
            <li>
              <Link href="/library" className="font-medium underline">Library</Link> — waves, uploads, the review
              queue, source documents and your saved outputs.
            </li>
            <li>
              <Link href="/admin" className="font-medium underline">Administration</Link> (admins) — users, segments,
              themes, clients and projects, the audit log, and AI usage &amp; cost including which model is in use.
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

          <h3 className="pt-2 font-medium text-brand-900">Approving a document: the order, and what it means</h3>
          <p>
            <strong>Accept AI tags first, then Approve &amp; index.</strong> That is also the only order available:
            tags can only be accepted while the document is in review, and approving takes it out of review.
          </p>
          <p>
            It is worth knowing what each button actually does, because they are not two halves of the same step:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Approve &amp; index</strong> is what makes the document searchable. Nothing in it can be
              retrieved, quoted or counted until you approve it.
            </li>
            <li>
              <strong>Accept AI tags</strong> does <em>not</em> switch the tags on — an AI-suggested theme tag already
              counts for filtering and for Trends exactly like a confirmed one. What accepting changes is
              <em> provenance</em>: it records the tags as confirmed by a person, under your name, in the audit log.
            </li>
          </ul>
          <p>
            So treat it as a statement, not a formality. Don&apos;t click <em>Accept AI tags</em> reflexively before
            reading — one click can certify forty tags as human-checked. Scan the chips first; toggle any you disagree
            with; then accept the rest. Skipping it entirely does no harm, and simply leaves those tags honestly
            labelled as unconfirmed AI output.
          </p>

          <h3 className="pt-2 font-medium text-brand-900">When a file is refused or fails</h3>
          <p>
            A <strong>.docx</strong>, <strong>.pptx</strong> or <strong>.xlsx</strong> is a specific file format, not
            just an extension. Renaming an old <em>.doc</em>, an <em>.rtf</em>, or a page saved from a browser or email
            does not convert it — Word will open such a file happily, which is why it looks fine on your machine, but
            nothing can read it here. The upload is refused straight away and names the format the file turned out to
            be. The fix is always the same: open it in Office, <strong>File → Save As</strong> in the modern format,
            and upload the saved copy.
          </p>
          <p>
            If a document does fail after upload, it shows on the wave page with the reason and what to do about it.
            Nothing from a failed file is indexed. Upload the corrected file under the same name and it becomes the
            next version; the failed copy stays on record. A failed document does not block you from confirming the
            wave — so check the wave is not missing a report before you confirm it.
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
            date. Report quotes show the report&apos;s <strong>exact fieldwork date</strong> (e.g. 1 Jul 2026), not just
            the month. Because these come from reports rather than raw transcripts, <strong>everyone can search
            them</strong> — a transcript-access account is only needed for raw interview verbatim.
          </p>
        </SectionCard>

        <SectionCard accent="bg-sr-blue" title="Most common words & phrases">
          <p>
            On <Link href="/trends" className="font-medium underline">Trends</Link>, the{" "}
            <strong>Most common words &amp; phrases</strong> panel counts the language consumers use across reports in a
            period. Set a <em>From</em> and <em>To</em> month, and optionally a <strong>topic</strong> to see the words
            used to describe it — for example <em>the economy</em>, <em>house buying</em> or <em>COVID</em> between two
            dates.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>It reports both single words and short phrases (an internal joining word is kept, so <em>cost of living</em> shows as one phrase).</li>
            <li>Everyday filler words are removed, and a word or phrase seen only once is not counted as &ldquo;common&rdquo;.</li>
            <li>Counts run over reports only (not transcripts) and respect your access. A small base is flagged so you don&apos;t over-read a handful of passages.</li>
          </ul>
        </SectionCard>

        <SectionCard accent="bg-sr-purple" title="Third-party data & published statistics">
          <p>
            Free external material — ONS releases, industry reports, open data — can be uploaded alongside your own
            research. Choose the source type <strong>Third-party data / published stats</strong>, and record the
            publisher, licence and source URL so attribution travels with the document.
          </p>
          <p>
            It is deliberately treated as <strong>context, never consumer voice</strong>, and the system enforces that
            rather than relying on anyone remembering:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>It can never become a consumer quote — even a quotation printed inside a statistics report is ignored by the verbatim extractor.</li>
            <li>It is excluded from interview, wave and segment counts, so a single data release can&apos;t make a theme look like it surged. Any reference passages used are reported separately beneath the answer.</li>
            <li>Every citation from it carries a <strong>third-party data</strong> badge, and the AI is instructed to attribute it explicitly (&ldquo;published figures show…&rdquo;) and never present it as something consumers said.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            One thing the software can&apos;t check for you: whether the licence permits use in a client-facing tool.
            Open Government Licence material is generally fine with attribution; most paywalled or subscription
            research is not, even when you can read it for free.
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

        <SectionCard accent="bg-sr-orange" title="Administration (admins only)">
          <p>
            <Link href="/admin" className="font-medium underline">Administration</Link> is where the archive is
            configured — no developer or reseeding required.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Users</strong> — add people, set role (viewer / researcher / admin), grant or remove transcript
              access, deactivate accounts.
            </li>
            <li>
              <strong>Segments</strong> — add, rename, describe and merge consumer segments. Each shows how many
              passages it has: a segment reading <strong>0 — unmatched</strong> means your reports&apos; (Segment,
              Region) attributions aren&apos;t matching that spelling, which is the quickest way to spot an ingestion
              problem.
            </li>
            <li>
              <strong>Themes</strong> — add and define themes, merge duplicates (traceable, never destructive), and
              accept or dismiss new themes the ingest AI proposes.
            </li>
            <li>
              <strong>Suggestions</strong> — the example questions on Ask the Archive and the example searches on Find
              Quotes. By default these are generated from the themes, segments and waves that are actually indexed, so
              they always return something and never go stale as the archive grows. Override them here to use your own
              wording, and reset to go back to the generated list.
            </li>
            <li>
              <strong>Projects</strong> — create clients and projects, set lawful basis and retention.
            </li>
            <li>
              <strong>Audit log</strong> — a plain-English record of every sign-in, upload, approval, search, export and
              permission change. Search terms themselves are never stored, only a one-way hash.
            </li>
            <li>
              <strong>Usage &amp; cost</strong> — see below.
            </li>
          </ul>
          <p>
            <strong>Wave numbers</strong> after a bulk import are a guess: each wave is numbered by how many earlier
            waves existed when it was created, so a back-catalogue loaded newest-first can leave several waves called
            &ldquo;Wave 1&rdquo;. <strong>Renumber waves by date</strong> in the Library puts a project straight as 1, 2,
            3… in date order. Don&apos;t use it if your numbers come from the real fieldwork series (Wave 32 of 76) —
            edit those individually instead.
          </p>
          <p>
            Waves can also be corrected in the <Link href="/library" className="font-medium underline">Library</Link>:
            open a draft wave to fix its number, month, year or key events. A confirmed wave is locked, and an empty
            wave (say, one created by a mistyped filename during bulk upload) can be deleted by an admin.
          </p>
        </SectionCard>

        <SectionCard accent="bg-sr-blue" title="AI cost & choosing a model">
          <p>
            <strong>Usage &amp; cost</strong> in Administration accounts for <em>every</em> billable AI call — answers,
            comparisons, reports, ingestion tagging, and the embeddings behind both ingestion and every single search.
            You get total spend, this month, last 30 days, a chat-versus-embeddings split, and a breakdown of which
            activity the money actually goes on.
          </p>
          <p>
            Token counts are exact, taken from each provider response. Prices are held in the provider&apos;s own
            currency (USD) and converted to £ at that day&apos;s exchange rate, so figures always read in today&apos;s
            money and can be reconciled against an invoice. The rate card shows every price and where it came from; if
            a model has no price configured, the page says so rather than quietly counting it as free.
          </p>
          <p>
            <strong>Changing model.</strong> Admins can switch the model used for answers and for ingestion tagging,
            with each option&apos;s price shown at the point of choosing. The change takes effect on the next request —
            no redeploy. Models differ several-fold in price, so it is worth running the same briefing on two of them
            and judging quality against the saving yourself.
          </p>
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
            <Table className="min-w-[520px] text-sm">
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
