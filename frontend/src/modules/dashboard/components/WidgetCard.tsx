"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * WidgetCard — shared shell used by Admin + Teacher dashboards.
 *
 * Mobile-first sizing (≥360px works). Hover lift kept subtle since the
 * surface is information-dense; teachers on phones don't get hover anyway.
 */

interface WidgetCardProps {
  title: string;
  /** Tiny eyebrow label above the title; usually a temporal label like "Hôm nay". */
  eyebrow?: string;
  /** Pre-rendered icon element (e.g. `<Calendar className="h-5 w-5" />`). Must be an element, not a component reference — this component is a Client boundary and component refs can't be serialized from RSC. */
  icon?: ReactNode;
  /** Accent applied to the icon + eyebrow color. */
  accent?: "indigo" | "amber" | "emerald" | "rose" | "slate" | "cyan";
  /** Adds a "Xem chi tiết" CTA in the header. The href is omitted here — wire later. */
  showSeeMore?: boolean;
  /** Tour anchor — emitted as `data-tour="<value>"` on the outer section so
   *  the guided tour (sidebar-tour.tsx) can locate this card. */
  tourKey?: string;
  children: ReactNode;
}

const ACCENT_BG: Record<NonNullable<WidgetCardProps["accent"]>, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

const ACCENT_TEXT: Record<NonNullable<WidgetCardProps["accent"]>, string> = {
  indigo: "text-indigo-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  slate: "text-slate-500",
  cyan: "text-cyan-700",
};

export default function WidgetCard({
  title,
  eyebrow,
  icon,
  accent = "slate",
  showSeeMore = false,
  tourKey,
  children,
}: WidgetCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" as const }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      data-tour={tourKey}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENT_BG[accent]}`}
              aria-hidden
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p
                className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${ACCENT_TEXT[accent]}`}
              >
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h2>
          </div>
        </div>

        {showSeeMore ? (
          <span className="hidden text-xs font-medium text-slate-400 sm:inline">
            Xem chi tiết →
          </span>
        ) : null}
      </header>

      <div className="mt-4">{children}</div>
    </motion.section>
  );
}
