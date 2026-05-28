"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, List, User, Users } from "lucide-react";
import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import type { TenantTeacherRow } from "@/types/database";
import SessionList from "./SessionList";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import SessionDetailsDialog from "./SessionDetailsDialog";

type ViewId = "week" | "month" | "list";
type LensId = "all" | "mine";

interface CalendarBoardProps {
  sessions: TeacherSessionRow[];
  teachers: Pick<TenantTeacherRow, "id" | "display_name" | "color" | "is_admin">[];
  currentTeacherId: string | null;
  /** Center admin gate. Enables Edit / Cancel actions in the details dialog. */
  isAdmin: boolean;
}

const VI_MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay() === 0 ? 6 : out.getDay() - 1;
  out.setDate(out.getDate() - dow);
  return out;
}

function endOfWeek(weekStart: Date): Date {
  const out = new Date(weekStart);
  out.setDate(out.getDate() + 6);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${VI_MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${VI_MONTHS[weekStart.getMonth()]} – ${weekEnd.getDate()} ${VI_MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
}

export default function CalendarBoard({
  sessions,
  teachers,
  currentTeacherId,
  isAdmin,
}: CalendarBoardProps) {
  const [view, setView] = useState<ViewId>("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] =
    useState<TeacherSessionRow | null>(null);

  // Multi-teacher controls only render when the tenant has more than one slot.
  const hasMultiTeacher = teachers.length > 1;
  const [lens, setLens] = useState<LensId>("all");
  // Selected teacher ids for filter pills. Empty set = "show all" (we treat
  // the empty set as no filter so a fresh page mount always shows everything).
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(
    () => new Set(),
  );

  const filteredSessions = useMemo(() => {
    if (!hasMultiTeacher) return sessions;
    return sessions.filter((s) => {
      if (lens === "mine") {
        return s.teacher_id === currentTeacherId;
      }
      if (selectedTeacherIds.size === 0) return true;
      return s.teacher_id ? selectedTeacherIds.has(s.teacher_id) : false;
    });
  }, [sessions, hasMultiTeacher, lens, currentTeacherId, selectedTeacherIds]);

  function toggleTeacher(id: string) {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const weekStart = startOfWeekMonday(cursor);

  function goPrev() {
    if (view === "week") setCursor(addDays(cursor, -7));
    else if (view === "month") setCursor(addMonths(cursor, -1));
  }
  function goNext() {
    if (view === "week") setCursor(addDays(cursor, 7));
    else if (view === "month") setCursor(addMonths(cursor, 1));
  }
  function goToday() {
    setCursor(new Date());
  }

  const rangeLabel =
    view === "week"
      ? formatWeekRange(weekStart)
      : view === "month"
        ? `${VI_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : "Toàn bộ buổi học";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Tuần / tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={goNext}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Tuần / tháng kế"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <h2 className="ml-1 text-sm font-semibold text-slate-800">
            {rangeLabel}
          </h2>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(
            [
              { id: "week", label: "Tuần", icon: CalendarIcon },
              { id: "month", label: "Tháng", icon: LayoutGrid },
              { id: "list", label: "Danh sách", icon: List },
            ] as const
          ).map((tab) => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-teacher controls (lens + per-teacher pills). Hidden for solo
          tenants so the toolbar stays uncluttered. */}
      {hasMultiTeacher && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          {/* Lens chip */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { id: "all", label: "Tất cả giáo viên", icon: Users },
                { id: "mine", label: "Chỉ của tôi", icon: User },
              ] as const
            ).map((l) => {
              const isActive = lens === l.id;
              const isDisabled = l.id === "mine" && !currentTeacherId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLens(l.id)}
                  disabled={isDisabled}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <l.icon className="h-3.5 w-3.5" />
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* Per-teacher pills (only meaningful in "all" lens) */}
          {lens === "all" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                Lọc:
              </span>
              {teachers.map((t) => {
                const isActive =
                  selectedTeacherIds.size === 0 ||
                  selectedTeacherIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTeacher(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "border-slate-200 bg-white text-slate-700"
                        : "border-slate-100 bg-slate-50 text-slate-400 line-through"
                    }`}
                    title={
                      isActive
                        ? `Ẩn ${t.display_name}`
                        : `Hiện ${t.display_name}`
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: t.color }}
                    />
                    {t.display_name}
                  </button>
                );
              })}
              {selectedTeacherIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTeacherIds(new Set())}
                  className="ml-1 font-mono text-[10px] uppercase tracking-wide text-slate-400 hover:text-slate-700"
                >
                  Đặt lại
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {view === "week" && (
        <WeekView
          sessions={filteredSessions}
          weekStart={weekStart}
          onSelectSession={setSelectedSession}
        />
      )}
      {view === "month" && (
        <MonthView
          sessions={filteredSessions}
          cursorDate={cursor}
          onSelectDay={(date) => {
            setCursor(date);
            setView("week");
          }}
        />
      )}
      {view === "list" && <SessionList sessions={filteredSessions} />}

      <SessionDetailsDialog
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        isAdmin={isAdmin}
        currentTeacherId={currentTeacherId}
        teachers={teachers}
      />
    </div>
  );
}
