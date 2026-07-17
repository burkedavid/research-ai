import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getSharedOutput } from "@/lib/services/sharing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared insight — Sentiment Research" };

interface SharedContent {
  question?: string;
  answer?: string;
  text?: string;
  quotes?: { quote: string; wave: string; interviewRef?: string | null; segmentName?: string | null }[];
  sections?: { heading: string; text: string }[];
  sideA?: { label: string };
  sideB?: { label: string };
}

/** Public, read-only view of a shared saved output (F3). No auth; shows only
 *  the generated content, never raw retrieval or transcript material. */
export default async function SharedOutputPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const output = await getSharedOutput(token);
  if (!output) notFound();
  const content = output.content as SharedContent;

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="h-1 w-full bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <BrandMark size={34} />
          <div>
            <p className="text-sm font-bold text-brand-900">Sentiment Research</p>
            <p className="text-[11px] text-muted-foreground">Shared insight — read only</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800">
          {output.kind.replace(/_/g, " ")}
        </span>
        <h1 className="mt-3 text-2xl font-semibold text-brand-900">{output.title}</h1>

        <article className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
          {content.question && <p className="text-sm italic text-muted-foreground">Q: {content.question}</p>}

          {content.answer && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{content.answer}</p>
          )}
          {content.text && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{content.text}</p>
          )}
          {content.quotes && (
            <ul className="space-y-3">
              {content.quotes.map((q, i) => (
                <li key={i} className="border-l-2 border-brand-300 pl-3">
                  <p className="text-sm text-slate-800">“{q.quote}”</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {q.interviewRef ?? "consumer"}
                    {q.segmentName ? ` · ${q.segmentName}` : ""} · {q.wave}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {content.sections && (
            <div className="space-y-4">
              {content.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="font-medium text-brand-900">{s.heading}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{s.text}</p>
                </section>
              ))}
            </div>
          )}
        </article>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Shared from the Consumer Sentiment Intelligence Hub. AI-assisted research output — grounded in archive
          evidence and reviewed before sharing.
        </p>
      </main>
    </div>
  );
}
