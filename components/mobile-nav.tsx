"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";

interface NavItem {
  href: string;
  label: string;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    ask: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
    compare: (
      <>
        <path d="M16 3h5v5" />
        <path d="M8 21H3v-5" />
        <path d="M21 3l-7.5 7.5" />
        <path d="M3 21l7.5-7.5" />
      </>
    ),
    segments: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    quotes: (
      <>
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2z" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2z" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

const PRIMARY_TABS = [
  { href: "/ask", label: "Ask", icon: "ask" },
  { href: "/compare", label: "Compare", icon: "compare" },
  { href: "/segments", label: "Segments", icon: "segments" },
  { href: "/quotes", label: "Quotes", icon: "quotes" },
] as const;

/**
 * Mobile/tablet navigation (< lg): slim top brand bar plus a fixed bottom tab
 * bar (Facebook-style). The four primary actions are always visible; "More"
 * opens a sheet with the rest, the user and sign out.
 */
export function MobileNav({
  items,
  userName,
  userMeta,
  signOutAction,
}: {
  items: NavItem[];
  userName: string;
  userMeta: string;
  signOutAction: () => Promise<void>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet when the route changes
    setMoreOpen(false);
  }, [pathname]);

  const primaryHrefs = new Set<string>(PRIMARY_TABS.map((t) => t.href));
  const moreItems = items.filter((i) => !primaryHrefs.has(i.href));
  const moreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* top brand bar */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="h-1 w-full bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
        <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-2">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="text-sm font-bold text-brand-900">Sentiment Research</span>
          </Link>
        </div>
      </div>

      {/* "more" sheet */}
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-brand-950/30 lg:hidden"
          />
          <div className="fixed inset-x-0 bottom-14 z-50 rounded-t-2xl border-t border-border bg-white px-2 pb-2 pt-3 shadow-2xl lg:hidden">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-4 py-2.5 text-sm font-medium ${pathname.startsWith(item.href) ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-brand-50 hover:text-brand-900"}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border px-4 pb-1 pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-900">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userMeta}</p>
              </div>
              <form action={signOutAction}>
                <button type="submit" className="text-xs text-muted-foreground underline hover:text-brand-900">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY_TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? "text-brand-900" : "text-slate-400"}`}
              >
                <Icon name={tab.icon} className="size-5" />
                {tab.label}
                <span className={`h-0.5 w-6 rounded-full ${active ? "bg-[linear-gradient(90deg,#ff8155,#52e838,#7263ff)]" : "bg-transparent"}`} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${moreActive || moreOpen ? "text-brand-900" : "text-slate-400"}`}
          >
            <Icon name="more" className="size-5" />
            More
            <span className={`h-0.5 w-6 rounded-full ${moreActive ? "bg-[linear-gradient(90deg,#ff8155,#52e838,#7263ff)]" : "bg-transparent"}`} />
          </button>
        </div>
      </nav>
    </>
  );
}
