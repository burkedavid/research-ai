import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedOutputs } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { AiText } from "@/components/ai-text";
import { NavIcon } from "@/components/nav-icons";
import { ShareControls } from "./share-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved outputs" };

interface SavedAnswer {
  question?: string;
  answer?: string;
  text?: string;
  quotes?: { quote: string; wave: string; interviewRef?: string | null }[];
  sections?: { heading: string; text: string }[];
}

function OutputPreview({ kind, content }: { kind: string; content: SavedAnswer }) {
  if (kind === "answer") {
    return (
      <div>
        {content.question && <p className="text-xs italic text-muted-foreground">Q: {content.question}</p>}
        <AiText text={content.answer ?? ""} className="mt-1" />
      </div>
    );
  }
  if (kind === "quote_list") {
    return (
      <ul className="space-y-1">
        {(content.quotes ?? []).map((q, i) => (
          <li key={i} className="border-l-2 border-border pl-2 text-sm text-foreground/80">
            “{q.quote}” <span className="text-xs text-muted-foreground">({q.interviewRef ?? "consumer"}, {q.wave})</span>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "comparison") {
    return <AiText text={content.text ?? ""} />;
  }
  return (
    <div className="space-y-2">
      {(content.sections ?? []).map((s, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-foreground">{s.heading}</p>
          <AiText text={s.text} />
        </div>
      ))}
    </div>
  );
}

export default async function SavedOutputsPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(savedOutputs)
    .where(eq(savedOutputs.userId, user.id))
    .orderBy(desc(savedOutputs.createdAt));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/library" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        ← Library
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Saved outputs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Answers, quote shortlists, comparisons and report drafts you have saved.</p>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-sr-purple/10 text-purple-600">
              <NavIcon name="library" className="size-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground">Nothing saved yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Use <strong>Save to library</strong> on an answer, comparison, quote shortlist or report draft, and it will
              appear here — ready to reopen or share with a read-only link.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/ask" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand-600 hover:text-brand-900">Ask the Archive</Link>
              <Link href="/quotes" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand-600 hover:text-brand-900">Find Quotes</Link>
              <Link href="/reports" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-brand-600 hover:text-brand-900">Create Report</Link>
            </div>
          </div>
        )}
        {rows.map((row) => (
          <details key={row.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <summary className="cursor-pointer">
              <span className="font-medium text-foreground">{row.title}</span>
              <Badge variant="secondary" className="ml-2">
                {row.kind.replace(/_/g, " ")}
              </Badge>
              <span className="ml-2 text-xs text-muted-foreground">{row.createdAt.toISOString().slice(0, 10)}</span>
            </summary>
            <div className="mt-3 border-t border-border pt-3">
              <OutputPreview kind={row.kind} content={row.content as SavedAnswer} />
              <div className="mt-3 border-t border-border pt-3">
                <ShareControls id={row.id} initialToken={row.shareToken} />
                {row.shareToken && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Anyone with this link can view this output (read-only, no login). Revoke to disable it.
                  </p>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
