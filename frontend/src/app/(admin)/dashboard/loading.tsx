import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

// Default loading state for every /dashboard/* route that doesn't define
// its own loading.tsx. Mirrors the typical admin page chrome (header +
// stat row + table) so the swap-in feels like the real page filling in.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}
