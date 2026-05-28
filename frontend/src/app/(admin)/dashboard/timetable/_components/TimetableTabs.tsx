"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  GraduationCap,
  LayoutGrid,
} from "lucide-react";

/**
 * Top tab strip for /dashboard/timetable. Pure presentation — each tab is
 * a Link that swaps the child route. Highlights the active one.
 */
const TABS = [
  {
    href: "/dashboard/timetable/classes",
    label: "Lớp",
    icon: GraduationCap,
    hint: "Danh sách lớp",
  },
  {
    href: "/dashboard/timetable/subjects",
    label: "Môn học",
    icon: LayoutGrid,
    hint: "Toán, Văn, …",
  },
  {
    href: "/dashboard/timetable/periods",
    label: "Khung tiết",
    icon: Clock,
    hint: "T1 = 7:00–7:45",
  },
  {
    href: "/dashboard/timetable/editor",
    label: "Thời khoá biểu",
    icon: CalendarDays,
    hint: "Gán môn + giáo viên",
  },
];

export default function TimetableTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Thời khoá biểu"
      // Grid-1-col on mobile (vertical stack), grid-4-cols sm+ so each tab
      // gets equal width and stretches to fill the container.
      className="grid grid-cols-1 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-4"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={
              tab.href === "/dashboard/timetable/editor"
                ? "tkb.editor-link"
                : undefined
            }
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex min-w-0 flex-col items-start leading-tight sm:flex-row sm:items-center sm:gap-1.5">
              <span className="whitespace-nowrap">{tab.label}</span>
              <span
                className={`hidden truncate font-normal lg:inline ${
                  isActive ? "text-slate-300" : "text-slate-400"
                }`}
              >
                · {tab.hint}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
