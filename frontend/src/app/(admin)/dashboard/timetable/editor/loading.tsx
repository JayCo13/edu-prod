import { GridSkeleton, Skeleton } from "@/components/ui/skeleton";

// TKB editor is the heaviest page in the admin app (2900-line client
// component + 3 server fetches: classes, periods, subjects). Show the
// grid shape immediately so the user knows where they landed.
export default function TimetableEditorLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Toolbar row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Grade pills */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-14 rounded-full" />
        ))}
      </div>

      {/* Two grids stacked (Sáng + Chiều) */}
      <Skeleton className="h-4 w-16" />
      <GridSkeleton rows={5} cols={7} />
      <Skeleton className="h-4 w-16 mt-2" />
      <GridSkeleton rows={5} cols={7} />
    </div>
  );
}
