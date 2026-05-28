import { GridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <GridSkeleton rows={6} cols={7} />
    </div>
  );
}
