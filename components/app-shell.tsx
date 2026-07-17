import Link from "next/link";
import { signOut } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import type { SessionUser } from "@/lib/errors";

const NAV = [
  { href: "/ask", label: "Ask the Archive" },
  { href: "/compare", label: "Compare Periods" },
  { href: "/segments", label: "Explore Segments" },
  { href: "/quotes", label: "Find Quotes" },
  { href: "/reports", label: "Create Report" },
  { href: "/library", label: "Library" },
  { href: "/help", label: "Help" },
] as const;

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const items = [...NAV, ...(user.role === "admin" ? [{ href: "/admin", label: "Administration" }] : [])];
  const userMeta = `${user.role}${user.transcriptAccess ? " · transcript access" : ""}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <MobileNav items={items} userName={user.name} userMeta={userMeta} signOutAction={doSignOut} />

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-white lg:flex">
        {/* the mark's palette as a signature accent line */}
        <div className="h-1 w-full bg-[linear-gradient(90deg,#ff8155,#ffcc39,#52e838,#49ffef,#4aa8ff,#cd4dff)]" />
        <div className="border-b border-border px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <span>
              <span className="block text-sm font-bold leading-tight text-brand-900">Sentiment Research</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">Consumer Sentiment Hub</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3">
          <p className="truncate text-sm font-medium text-brand-900">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{userMeta}</p>
          <form action={doSignOut}>
            <button type="submit" className="mt-2 text-xs text-muted-foreground underline hover:text-brand-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* bottom padding on small screens so the fixed tab bar never covers content */}
      <main className="min-w-0 flex-1 pb-16 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
