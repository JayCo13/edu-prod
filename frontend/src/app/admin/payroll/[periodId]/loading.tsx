import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function PayrollPeriodLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <TableSkeleton rows={10} />
    </div>
  );
}
