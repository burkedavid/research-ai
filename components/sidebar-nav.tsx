"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, iconForHref } from "@/components/nav-icons";

export interface NavGroup {
  label?: string;
  items: { href: string; label: string }[];
}

/** Desktop sidebar navigation with grouped sections and an active state. */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="flex-1 space-y-6 px-3 py-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                    active ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-100 hover:text-brand-900"
                  }`}
                >
                  {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-700" />}
                  <NavIcon name={iconForHref(item.href)} className={`size-4 shrink-0 ${active ? "text-brand-700" : "opacity-60"}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
