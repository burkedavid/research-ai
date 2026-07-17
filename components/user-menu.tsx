"use client";

import { useEffect, useRef, useState } from "react";

/** Top-right user-profile menu with a proper sign-out (F-chrome). */
export function UserMenu({
  name,
  role,
  transcriptAccess,
  email,
  signOutAction,
  compact = false,
}: {
  name: string;
  role: string;
  transcriptAccess: boolean;
  email?: string | null;
  signOutAction: () => Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-brand-50 active:bg-brand-100 sm:pr-2"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">
          {initials}
        </span>
        {!compact && (
          <span className="hidden min-w-0 text-left leading-tight sm:block">
            <span className="block truncate text-sm font-medium text-brand-900">{name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{role}</span>
          </span>
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hidden size-4 text-muted-foreground sm:block" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="border-b border-border bg-brand-50/50 px-4 py-3">
            <p className="truncate text-sm font-semibold text-brand-900">{name}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-brand-900 px-2 py-0.5 text-[10px] font-medium text-white">{role}</span>
              {transcriptAccess && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
                  transcript access
                </span>
              )}
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-brand-50 active:bg-brand-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
