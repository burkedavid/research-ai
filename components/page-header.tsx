import { NavIcon, type IconName } from "@/components/nav-icons";

/** Shared page header: optional icon, title, gradient signature underline, subtitle. */
export function PageHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: IconName }) {
  return (
    <div className="pb-2 pt-2">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <NavIcon name={icon} className="size-5" />
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">{title}</h1>
      </div>
      <div className="mt-2 h-0.5 w-16 bg-[linear-gradient(90deg,#f79552,#ffc84d,#2fe872,#00f0d1,#00b5ff,#9a6cf0)]" />
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
