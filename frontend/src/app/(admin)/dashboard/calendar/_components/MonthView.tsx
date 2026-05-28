"use client";

import { useMemo } from "react";
import { Pin } from "lucide-react";
import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import { detectProvider } from "@/lib/meeting-provider";

const VI_WEEKDAYS_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface MonthViewProps {
  sessions: TeacherSessionRow[];
  cursorDate: Date;
  /** Called when the user clicks a day (e.g. to switch to week view focused there). */
  onSelectDay?: (date: Date) => void;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  sessions: TeacherSessionRow[];
}

function startOfMonthGrid(d: Date): Date {
  // First day of month, then back up to Monday.
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dow = first.getDay() === 0 ? 6 : first.getDay() - 1; // Mon=0 … Sun=6
  first.setDate(first.getDate() - dow);
  return first;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MonthView({
  sessions,
  cursorDate,
  onSelectDay,
}: MonthViewProps) {
  const cells = useMemo<DayCell[]>(() => {
    const start = startOfMonthGrid(cursorDate);
    const month = cursorDate.getMonth();
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const matched = sessions.filter((s) =>
        isSameDay(new Date(s.start_time), date),
      );
      return {
        date,
        isCurrentMonth: date.getMonth() === month,
        sessions: matched.sort(
          (a, b) =>
            new Date(a.start_time).getTime() -
            new Date(b.start_time).getTime(),
        ),
      };
    });
  }, [sessions, cursorDate]);

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center">
        {VI_WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            className="border-l border-slate-100 px-2 py-2 font-mono text-[10px] uppercase tracking-wide text-slate-500 first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 6×7 day grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isToday = isSameDay(cell.date, today);
          const dayLabel = cell.date.getDate();
          const visible = cell.sessions.slice(0, 3);
          const overflow = cell.sessions.length - visible.length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay?.(cell.date)}
              className={`flex min-h-[96px] flex-col gap-1 border-l border-t border-slate-100 px-1.5 py-1.5 text-left transition-colors first:border-l-0 hover:bg-slate-50/60 ${
                cell.isCurrentMonth ? "bg-white" : "bg-slate-50/40"
              } ${i < 7 ? "border-t-0" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-mono tabular-nums ${
                    isToday
                      ? "bg-indigo-600 text-white"
                      : cell.isCurrentMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {dayLabel}
                </span>
                {cell.sessions.length > 0 && (
                  <span className="font-mono text-[9px] text-slate-400">
                    {cell.sessions.length} buổi
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                {visible.map((s) => {
                  const provider = detectProvider(s.meeting_url);
                  const teacherColor = s.teacher?.color ?? provider.color;
                  const start = new Date(s.start_time);
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                        s.is_cancelled
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                      style={{
                        background: s.is_cancelled
                          ? "#f1f5f9"
                          : `${teacherColor}15`,
                        borderLeft: `2px solid ${s.is_cancelled ? "#cbd5e1" : teacherColor}`,
                      }}
                      title={
                        s.teacher
                          ? `${s.title} · ${s.teacher.display_name}`
                          : s.title
                      }
                    >
                      <span className="font-mono tabular-nums text-slate-500">
                        {start.getHours().toString().padStart(2, "0")}:
                        {start.getMinutes().toString().padStart(2, "0")}
                      </span>
                      <span className="truncate">{s.title}</span>
                      {s.kind === "recurring" && (
                        <Pin
                          className="ml-auto h-2.5 w-2.5 flex-shrink-0 text-indigo-500"
                          aria-label="Buổi định kỳ"
                        />
                      )}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="font-mono text-[9px] text-slate-400">
                    +{overflow} buổi nữa
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
