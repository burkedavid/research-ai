/** Shared page header: title, gradient signature underline, subtitle. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-2 pt-2">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-900">{title}</h1>
      <div className="mt-2 h-0.5 w-16 bg-[linear-gradient(90deg,#f79552,#ffc84d,#2fe872,#00f0d1,#00b5ff,#9a6cf0)]" />
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
