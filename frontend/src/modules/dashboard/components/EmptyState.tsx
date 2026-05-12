import type { LucideIcon } from "lucide-react";

/**
 * EmptyState — placeholder content for widgets that have no data yet.
 *
 * All real data wires in later cycles per PRD §8.2. Until then every
 * widget renders this with a Vietnamese message.
 */

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  /** Optional secondary line (smaller, less prominent). */
  hint?: string;
}

export default function EmptyState({
  icon: Icon,
  message,
  hint,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center sm:py-10">
      {Icon ? (
        <Icon className="mb-3 h-6 w-6 text-slate-300" aria-hidden />
      ) : null}
      <p className="text-sm font-medium text-slate-500">{message}</p>
      {hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
