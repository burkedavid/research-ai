"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/user-menu";

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
  userRole,
  transcriptAccess,
  userEmail,
  signOutAction,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
  transcriptAccess: boolean;
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet when the route changes
    setMoreOpen(false);
  }, [pathname]);

  const primaryHrefs = new Set<string>(PRIMARY_TABS.map((t) => t.href));
  const helpHref = items.find((i) => i.href === "/help")?.href ?? null;
  // Help lives in the top-right; everything else not in the tab bar goes to "More"
  const moreItems = items.filter((i) => !primaryHrefs.has(i.href) && i.href !== "/help");
  const moreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* top brand bar */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="h-1 w-full bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
        <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandMark size={30} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold text-brand-900">Sentiment Research</span>
              <span className="block truncate text-[10px] text-muted-foreground">Consumer Sentiment Hub</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {helpHref && (
              <Link
                href={helpHref}
                aria-label="Help"
                className={`flex size-9 items-center justify-center rounded-full transition active:bg-brand-50 ${pathname.startsWith(helpHref) ? "text-brand-900" : "text-slate-400"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </Link>
            )}
            <UserMenu
              name={userName}
              role={userRole}
              transcriptAccess={transcriptAccess}
              email={userEmail}
              signOutAction={signOutAction}
              compact
            />
          </div>
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
          </div>
        </>
      )}

      {/* bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY_TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex touch-manipulation flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-100 active:bg-brand-50 ${active ? "text-brand-900" : "text-slate-400 active:text-brand-900"}`}
              >
                <span
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity ${active ? "bg-[linear-gradient(90deg,#ff8155,#52e838,#7263ff)] opacity-100" : "opacity-0"}`}
                />
                <Icon name={tab.icon} className={`size-5 transition-transform duration-100 active:scale-90 ${active ? "scale-110" : ""}`} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            className={`relative flex touch-manipulation flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-100 active:bg-brand-50 ${moreActive || moreOpen ? "text-brand-900" : "text-slate-400 active:text-brand-900"}`}
          >
            <span
              className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity ${moreActive || moreOpen ? "bg-[linear-gradient(90deg,#ff8155,#52e838,#7263ff)] opacity-100" : "opacity-0"}`}
            />
            <Icon name="more" className={`size-5 transition-transform duration-100 active:scale-90 ${moreActive || moreOpen ? "scale-110" : ""}`} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
