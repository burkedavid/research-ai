"use client";

import { useEffect, useState } from "react";

/**
 * Branded loading indicator (F-loading) — the Sentiment Research mark's colours
 * as sequenced pulsing dots, with rotating captions drawn from the actual
 * qualitative-research workflow so the wait feels purposeful and on-topic.
 */
const DOT_COLORS = ["#ff8155", "#ffcc39", "#52e838", "#49ffef", "#4aa8ff", "#cd4dff"];

const DEFAULT_MESSAGES = [
  "Searching the archive…",
  "Retrieving the strongest evidence…",
  "Reading the transcripts…",
  "Weighing the consumer voice…",
  "Checking every citation…",
  "Listening for the patterns…",
];

export function ResearchLoader({
  messages = DEFAULT_MESSAGES,
  label,
  fullScreen = false,
}: {
  messages?: string[];
  /** a single fixed caption instead of the rotating set */
  label?: string;
  fullScreen?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (label) return;
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 1800);
    return () => clearInterval(id);
  }, [label, messages.length]);

  const inner = (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="flex items-end gap-1.5">
        {DOT_COLORS.map((c, n) => (
          <span
            key={c}
            className="sr-loader-dot size-2.5 rounded-full"
            style={{ backgroundColor: c, animationDelay: `${n * 0.12}s` }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-brand-900">{label ?? messages[i]}</p>
      <style>{`
        @keyframes sr-loader-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.55; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
        .sr-loader-dot { animation: sr-loader-bounce 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sr-loader-dot { animation: none; opacity: 0.85; } }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return <div className="flex min-h-[60vh] w-full items-center justify-center p-8">{inner}</div>;
  }
  return <div className="flex w-full items-center justify-center py-10">{inner}</div>;
}
