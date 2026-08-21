"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders model output as formatted markdown.
 *
 * Real LLMs emit markdown (**bold**, headings, lists, tables) which showed as
 * literal characters when dropped into a <p>. react-markdown parses it; raw
 * HTML is NOT enabled, so model output cannot inject markup.
 *
 * Citation markers ([1], or [A2]/[B5] in comparisons) are turned into links to
 * the matching entry in the Sources list, so a marker is navigable rather than
 * an opaque token.
 */

const CITE = /\[([AB]?\d+)\]/g;

/**
 * Strip markdown to clean prose for clipboard and slide exports. The screen
 * renders markdown, but pasting into an email or slide deck must not carry
 * literal ## and ** through to a client-facing deliverable.
 */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Wrap citation markers in links, leaving all other text untouched. */
function linkCitations(children: React.ReactNode, citeHref: (n: string) => string): React.ReactNode {
  if (typeof children === "string") {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    CITE.lastIndex = 0;
    while ((m = CITE.exec(children)) !== null) {
      if (m.index > last) parts.push(children.slice(last, m.index));
      parts.push(
        <a
          key={`c${i++}`}
          href={citeHref(m[1])}
          title={`Jump to source ${m[1]}`}
          className="mx-0.5 rounded bg-brand-50 px-1 py-px align-baseline text-[0.78em] font-semibold text-brand-700 no-underline ring-1 ring-brand-100 transition hover:bg-brand-100"
        >
          {m[1]}
        </a>,
      );
      last = m.index + m[0].length;
    }
    if (!parts.length) return children;
    if (last < children.length) parts.push(children.slice(last));
    return parts;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => <span key={i}>{linkCitations(c, citeHref)}</span>);
  }
  return children;
}

export function AiText({
  text,
  className = "",
  citeHref = (n) => `#cite-${n}`,
}: {
  text: string;
  className?: string;
  /** Where a [n] marker should link to. Defaults to an anchor in the Sources list. */
  citeHref?: (n: string) => string;
}) {
  const cite = (children: React.ReactNode) => linkCitations(children, citeHref);

  return (
    <div className={`text-sm leading-6 text-slate-800 ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{cite(children)}</p>,
          strong: ({ children }) => <strong className="font-semibold text-brand-900">{cite(children)}</strong>,
          em: ({ children }) => <em>{cite(children)}</em>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{cite(children)}</li>,
          h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-brand-900 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-brand-900 first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-brand-900 first:mt-0">{children}</h4>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-brand-900 first:mt-0">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-brand-300 pl-3 italic text-slate-700 last:mb-0">{children}</blockquote>
          ),
          code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{children}</code>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline underline-offset-2">
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-border" />,
          // wide tables must scroll on a phone rather than overflow the page
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-border bg-slate-50 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{cite(children)}</td>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
