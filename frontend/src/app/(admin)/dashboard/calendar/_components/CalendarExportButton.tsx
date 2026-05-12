"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarArrowDown,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
} from "lucide-react";

import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import {
  downloadIcsBulk,
  type CalendarEvent,
} from "@/lib/calendar-export";
import { exportSessionsToExcel } from "@/lib/excel-export";

type ScopeId = "upcoming" | "next7" | "next30" | "all";

interface ScopeDef {
  id: ScopeId;
  label: string;
  hint: string;
}

const SCOPES: ScopeDef[] = [
  {
    id: "upcoming",
    label: "Tất cả buổi sắp tới",
    hint: "Bao gồm các buổi đang diễn ra. Bỏ qua buổi đã kết thúc và đã hủy.",
  },
  {
    id: "next7",
    label: "7 ngày tới",
    hint: "Các buổi bắt đầu trong vòng 7 ngày kể từ bây giờ.",
  },
  {
    id: "next30",
    label: "30 ngày tới",
    hint: "Các buổi bắt đầu trong vòng 30 ngày kể từ bây giờ.",
  },
  {
    id: "all",
    label: "Tất cả (kể cả đã kết thúc)",
    hint: "Toàn bộ lịch sử các buổi học đã lên lịch — hữu ích để sao lưu.",
  },
];

interface CalendarExportButtonProps {
  sessions: TeacherSessionRow[];
}

function sessionToCalendarEvent(s: TeacherSessionRow): CalendarEvent {
  return {
    uid: s.id,
    title: s.title,
    startIso: s.start_time,
    durationMinutes: s.duration_minutes,
    description: s.course?.title ? `Khóa học: ${s.course.title}` : undefined,
    meetingUrl: s.meeting_url,
  };
}

function filterByScope(
  sessions: TeacherSessionRow[],
  scope: ScopeId,
): TeacherSessionRow[] {
  const now = Date.now();
  return sessions.filter((s) => {
    if (scope === "all") return true;
    if (s.is_cancelled) return false;
    const start = new Date(s.start_time).getTime();
    const end = start + s.duration_minutes * 60 * 1000;
    if (now > end) return false; // ended
    if (scope === "upcoming") return true;
    const horizonMs = (scope === "next7" ? 7 : 30) * 24 * 60 * 60 * 1000;
    return start <= now + horizonMs;
  });
}

function formatDateForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export default function CalendarExportButton({
  sessions,
}: CalendarExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<ScopeId>("upcoming");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live-counted preview of how many sessions each scope would export. Memoised
  // so re-renders (the parent revalidates after every create/delete) stay cheap.
  const counts = useMemo(() => {
    const out = {} as Record<ScopeId, number>;
    for (const s of SCOPES) out[s.id] = filterByScope(sessions, s.id).length;
    return out;
  }, [sessions]);

  // Outside-click + Escape to close.
  useEffect(() => {
    if (!isOpen) return;
    function onClickAway(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("mousedown", onClickAway);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClickAway);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  function handleDownloadIcs(target: ScopeId) {
    const matched = filterByScope(sessions, target);
    if (matched.length === 0) {
      toast.error("Không có buổi học nào phù hợp với phạm vi đã chọn.");
      return;
    }
    const events = matched.map(sessionToCalendarEvent);
    const filename = `lich-day-truc-tuyen-${target}-${formatDateForFilename(new Date())}.ics`;
    downloadIcsBulk(events, filename);
    toast.success(
      `Đã tải ${matched.length} buổi học vào file ${filename}.`,
    );
    setIsOpen(false);
  }

  async function handleDownloadExcel(target: ScopeId) {
    const matched = filterByScope(sessions, target);
    if (matched.length === 0) {
      toast.error("Không có buổi học nào phù hợp với phạm vi đã chọn.");
      return;
    }
    const filename = `lich-day-truc-tuyen-${target}-${formatDateForFilename(new Date())}.xlsx`;
    try {
      setIsExportingExcel(true);
      await exportSessionsToExcel(matched, filename);
      toast.success(
        `Đã tải ${matched.length} buổi học vào file ${filename}.`,
      );
      setIsOpen(false);
    } catch (err) {
      console.error("excel export failed", err);
      toast.error("Không thể xuất Excel. Vui lòng thử lại.");
    } finally {
      setIsExportingExcel(false);
    }
  }

  const totalCount = sessions.length;
  const isDisabled = totalCount === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isDisabled}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        title={
          isDisabled
            ? "Chưa có buổi học nào để xuất"
            : "Xuất lịch dạy ra file .ics"
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <CalendarArrowDown className="h-4 w-4" />
        Xuất lịch
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            role="menu"
            className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-wide text-slate-400">
                Phạm vi xuất
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Chọn các buổi cần đưa vào file <span className="font-mono">.ics</span>.
                File này có thể nhập vào Google Calendar, Apple Calendar, Outlook…
              </p>
            </div>

            <ul className="max-h-80 overflow-y-auto py-1">
              {SCOPES.map((s) => {
                const count = counts[s.id];
                const isSelected = scope === s.id;
                const isEmpty = count === 0;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => setScope(s.id)}
                      className={`flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                        isSelected ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500 text-white"
                            : "border-slate-300 text-transparent"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {s.label}
                          </span>
                          <span
                            className={`font-mono text-[10.5px] tabular-nums ${
                              isEmpty ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {count} buổi
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-start gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] leading-snug text-slate-500">
              <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
              <span>
                Mẹo: nhập file <span className="font-mono">.ics</span> bằng tính
                năng &quot;Import&quot; trong Google Calendar / Apple Calendar
                để giữ lại link Zoom / Meet ở phần địa điểm.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Hủy
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadExcel(scope)}
                  disabled={counts[scope] === 0 || isExportingExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Xuất file Excel (.xlsx)"
                >
                  {isExportingExcel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadIcs(scope)}
                  disabled={counts[scope] === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Xuất file .ics (Apple Calendar, Outlook, …)"
                >
                  <Download className="h-3.5 w-3.5" />
                  .ics
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
