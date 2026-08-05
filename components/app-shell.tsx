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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <MobileNav
        items={items}
        userName={user.name}
        userRole={user.role}
        transcriptAccess={user.transcriptAccess}
        userEmail={user.email}
        signOutAction={doSignOut}
      />

      {/* Desktop top bar spans the FULL width above the sidebar + content, so
          the divider is a single continuous line and the logo cell's right
          border flows straight into the sidebar border. Quiet chrome: soft
          borders, no accent stripe. */}
      <div className="hidden lg:block">
        <header className="flex h-14 items-stretch border-b border-border/60 bg-white">
          <Link href="/" className="flex w-60 shrink-0 items-center gap-2.5 border-r border-border/60 px-4">
            <BrandMark size={32} />
            <span>
              <span className="block text-sm font-bold leading-tight text-brand-900">Sentiment Research</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">Consumer Sentiment Hub</span>
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center">
            <div className="mx-auto flex w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
              <p className="truncate text-sm font-semibold text-brand-900">Consumer Sentiment Intelligence Hub</p>
              <div className="ml-auto pl-3">
                <UserMenu
                  name={user.name}
                  role={user.role}
                  transcriptAccess={user.transcriptAccess}
                  email={user.email}
                  signOutAction={doSignOut}
                />
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Below the top bar: sidebar (desktop) + content */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border/60 bg-white lg:flex">
          <SidebarNav groups={groups} />
          <div className="mt-auto border-t border-border/60 px-3 py-3">
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

        {/* overflow-x-clip guards against page-level horizontal scroll on mobile
            without creating a scroll container (sticky panels and tables' own
            overflow-x-auto keep working). */}
        <main className="min-w-0 flex-1 overflow-x-clip pb-16 lg:pb-0">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
