import Link from "next/link";
import { signOut } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav, type NavGroup } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import type { SessionUser } from "@/lib/errors";

const ANALYSE = [
  { href: "/ask", label: "Ask the Archive" },
  { href: "/compare", label: "Compare Periods" },
  { href: "/trends", label: "Trends" },
  { href: "/segments", label: "Explore Segments" },
  { href: "/quotes", label: "Find Quotes" },
  { href: "/reports", label: "Create Report" },
];
const MANAGE = [
  { href: "/library", label: "Library" },
  { href: "/help", label: "Help" },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const groups: NavGroup[] = [
    { label: "Analyse", items: ANALYSE },
    { label: "Manage", items: [...MANAGE, ...(user.role === "admin" ? [{ href: "/admin", label: "Administration" }] : [])] },
  ];
  const items = [...ANALYSE, ...MANAGE, ...(user.role === "admin" ? [{ href: "/admin", label: "Administration" }] : [])];

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
        <SidebarNav groups={groups} />

        {/* user workspace at the foot of the sidebar */}
        <div className="mt-auto border-t border-border px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">
              {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-brand-900">{user.name}</span>
              <span className="block truncate text-[11px] capitalize text-muted-foreground">{user.role}</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {/* desktop top bar: product name (left) + user profile menu (right).
            Inner content shares the same max-w-7xl container + padding as the
            page body, so the header and page content line up on the left. */}
        <header className="hidden border-b border-border bg-white lg:block">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
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
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
