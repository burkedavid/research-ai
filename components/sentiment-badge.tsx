/**
 * AI-assessed emotional tone (F2), shown as a small caveated badge. Tone is
 * indicative only and never presented as statistical prevalence — the title
 * spells that out for anyone hovering.
 */
const STYLES: Record<string, string> = {
  positive: "bg-green-100 text-green-800 border-green-200",
  negative: "bg-red-100 text-red-800 border-red-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  mixed: "bg-amber-100 text-amber-800 border-amber-200",
};

const DOT: Record<string, string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-slate-400",
  mixed: "bg-amber-500",
};

export function SentimentBadge({ sentiment }: { sentiment: string | null | undefined }) {
  if (!sentiment) return null;
  return (
    <span
      title="AI-assessed tone — indicative only, not a statistical measure"
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STYLES[sentiment] ?? STYLES.neutral}`}
    >
      <span className={`size-1.5 rounded-full ${DOT[sentiment] ?? DOT.neutral}`} />
      {sentiment}
    </span>
  );
}
