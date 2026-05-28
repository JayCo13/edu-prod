"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import TimetableTabs from "./_components/TimetableTabs";

/**
 * /dashboard/timetable — sub-section for the school-timetable feature.
 *
 * Layout adds the section header + a horizontal tab strip. Children render
 * the actual list/editor.
 *
 * The editor route (/editor) renders its own header inline with the
 * export buttons (Excel / QR / Print), so this layout suppresses its
 * generic header there — otherwise users would see two stacked titles.
 */
export default function TimetableLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEditor = pathname?.endsWith("/timetable/editor");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!isEditor && (
        <>
          <header className="print:hidden" data-tkb-chrome="true">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Thời khoá biểu
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Sắp xếp thời khoá biểu
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Định nghĩa Lớp · Môn · Khung tiết, rồi gán vào grid thời khoá
              biểu để in và (sau này) tự tạo buổi học cho cả kỳ.
            </p>
          </header>
          <div className="print:hidden" data-tkb-chrome="true">
            <TimetableTabs />
          </div>
        </>
      )}
      {/* Editor renders its own header + tabs in-flow so the export buttons
          can sit next to the title and tabs appear below them. */}

      <div>{children}</div>
    </div>
  );
}
