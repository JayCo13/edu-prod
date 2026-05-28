import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function PayrollLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <TableSkeleton rows={6} />
    </div>
  );
}
