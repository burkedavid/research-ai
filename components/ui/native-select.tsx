import { cn } from "@/lib/utils";

/**
 * A native <select> styled to match the app's inputs — consistent height,
 * border, radius and a single custom chevron (no default OS look). Drop-in
 * replacement for a bare <select>.
 */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative inline-flex w-full">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-background px-2.5 pr-8 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
