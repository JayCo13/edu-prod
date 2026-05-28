import { Skeleton } from "@/components/ui/skeleton";

// Lightweight loading for public pages (auth, landing). The public
// layout's nav + footer stay rendered; only this central skeleton swaps
// in. Keep it neutral — the page underneath could be a form, a list, or
// a landing hero.
export default function PublicLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
