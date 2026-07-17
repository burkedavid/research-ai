import Link from "next/link";
import { signOut } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import type { SessionUser } from "@/lib/errors";

const NAV = [
  { href: "/ask", label: "Ask the Archive" },
  { href: "/compare", label: "Compare Periods" },
  { href: "/trends", label: "Trends" },
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <MobileNav
        items={items}
        userName={user.name}
        userRole={user.role}
        transcriptAccess={user.transcriptAccess}
        userEmail={user.email}
        signOutAction={doSignOut}
      />

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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {/* desktop top bar: product name (left) + user profile menu (right) */}
        <header className="hidden items-center gap-3 border-b border-border bg-white px-6 py-2.5 lg:flex">
          <p className="text-sm font-semibold text-brand-900">Consumer Sentiment Intelligence Hub</p>
          <div className="ml-auto">
            <UserMenu
              name={user.name}
              role={user.role}
              transcriptAccess={user.transcriptAccess}
              email={user.email}
              signOutAction={doSignOut}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
