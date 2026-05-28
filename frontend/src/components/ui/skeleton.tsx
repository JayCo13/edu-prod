import { cn } from "@/lib/utils";

// Pulse-animated placeholder block. Use this as the base for all loading
// states across the app so the look stays consistent — never raw
// `animate-pulse` divs scattered through pages.
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/40",
        className,
      )}
      {...props}
    />
  );
}

// Common page-level skeleton shapes. Each one mirrors the chrome of a
// typical admin page (title row + stat row + table) so the swap-in feels
// "filling in" rather than "popping in".
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({
  rows = 6,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="grid gap-px bg-slate-100"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-none bg-white" />
        ))}
      </div>
    </div>
  );
}
