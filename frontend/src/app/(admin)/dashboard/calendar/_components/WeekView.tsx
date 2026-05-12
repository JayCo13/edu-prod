"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import { detectProvider } from "@/lib/meeting-provider";

const HOUR_HEIGHT = 56; // px — one hour row
const VIEW_START_HOUR = 6; // grid starts at 06:00
const VIEW_END_HOUR = 24; // grid ends at 24:00 (exclusive)
const VISIBLE_HOURS = VIEW_END_HOUR - VIEW_START_HOUR;
const VI_WEEKDAYS_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Vietnamese teaching day-bands. Sáng / Tối / Đêm are the slots the user
// flagged; chiều stays uncoloured because it's the school-hours gap.
const TIME_BANDS = [
  {
    id: "sang",
    label: "Sáng",
    startHour: 6,
    endHour: 11,
    bg: "bg-amber-50/60",
    chip: "bg-amber-100 text-amber-700",
  },
  {
    id: "toi",
    label: "Tối",
    startHour: 17,
    endHour: 22,
    bg: "bg-indigo-50/60",
    chip: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "dem",
    label: "Đêm",
    startHour: 22,
    endHour: 24,
    bg: "bg-slate-100/70",
    chip: "bg-slate-200 text-slate-700",
  },
] as const;

interface WeekViewProps {
  sessions: TeacherSessionRow[];
  weekStart: Date;
}

interface PositionedSession {
  session: TeacherSessionRow;
  topPx: number;
  heightPx: number;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sessionToPositioned(s: TeacherSessionRow): PositionedSession {
  const start = new Date(s.start_time);
  const startMinutesFromGridTop =
    (start.getHours() - VIEW_START_HOUR) * 60 + start.getMinutes();
  const topPx = (startMinutesFromGridTop / 60) * HOUR_HEIGHT;
  // Clamp height so very-late sessions don't overflow the grid visually.
  const maxHeight = VISIBLE_HOURS * HOUR_HEIGHT - topPx;
  const heightPx = Math.min(
    (s.duration_minutes / 60) * HOUR_HEIGHT,
    maxHeight,
  );
  return { session: s, topPx, heightPx: Math.max(heightPx, 24) };
}

export default function WeekView({ sessions, weekStart }: WeekViewProps) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const sessionsByDay = useMemo(() => {
    const buckets: PositionedSession[][] = days.map(() => []);
    for (const s of sessions) {
      const start = new Date(s.start_time);
      const dayIdx = days.findIndex((d) => isSameDay(d, start));
      if (dayIdx === -1) continue;
      // Skip sessions outside the visible hour band.
      if (start.getHours() < VIEW_START_HOUR) continue;
      if (start.getHours() >= VIEW_END_HOUR) continue;
      buckets[dayIdx].push(sessionToPositioned(s));
    }
    return buckets;
  }, [sessions, days]);

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Time-band legend */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          Khung giờ:
        </span>
        {TIME_BANDS.map((b) => (
          <span
            key={b.id}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${b.chip}`}
          >
            {b.label} {b.startHour.toString().padStart(2, "0")}–
            {b.endHour.toString().padStart(2, "0")}h
          </span>
        ))}
      </div>

      {/* Day-of-week header row */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-100 bg-white text-center">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`border-l border-slate-100 px-2 py-2 ${isToday ? "bg-indigo-50/40" : ""}`}
            >
              <div className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {VI_WEEKDAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </div>
              <div
                className={`mt-0.5 text-sm font-semibold ${isToday ? "text-indigo-600" : "text-slate-700"}`}
              >
                {d.getDate()}/{d.getMonth() + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
        {/* Hour-label gutter */}
        <div className="border-r border-slate-100">
          {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
            const hour = VIEW_START_HOUR + i;
            return (
              <div
                key={hour}
                className="relative flex items-start justify-end px-2 pt-1 font-mono text-[10px] tabular-nums text-slate-400"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            );
          })}
        </div>

        {days.map((day, dayIdx) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`relative border-l border-slate-100 ${isToday ? "bg-indigo-50/30" : ""}`}
              style={{ height: VISIBLE_HOURS * HOUR_HEIGHT }}
            >
              {/* Time-band background washes */}
              {TIME_BANDS.map((b) => {
                const top = (b.startHour - VIEW_START_HOUR) * HOUR_HEIGHT;
                const height = (b.endHour - b.startHour) * HOUR_HEIGHT;
                return (
                  <div
                    key={b.id}
                    className={`pointer-events-none absolute left-0 right-0 ${b.bg}`}
                    style={{ top, height }}
                  />
                );
              })}

              {/* Hour grid lines */}
              {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute left-0 right-0 border-t border-slate-100"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {/* Session cards */}
              {sessionsByDay[dayIdx].map(({ session, topPx, heightPx }) => {
                const provider = detectProvider(session.meeting_url);
                const start = new Date(session.start_time);
                const isCancelled = session.is_cancelled;
                const isShort = heightPx < 48;
                // Teacher color drives the left edge — that's the visual key
                // for the calendar grid in multi-teacher centers. Provider
                // color stays on the small glyph chip.
                const teacherColor = session.teacher?.color ?? provider.color;
                return (
                  <Link
                    key={session.id}
                    href={`#session-${session.id}`}
                    className={`group absolute left-1 right-1 overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] shadow-sm transition-shadow hover:shadow-md ${
                      isCancelled
                        ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    style={{
                      top: topPx,
                      height: heightPx,
                      borderLeftWidth: 3,
                      borderLeftColor: isCancelled ? "#cbd5e1" : teacherColor,
                    }}
                    title={`${session.title}${session.teacher ? ` · ${session.teacher.display_name}` : ""} · ${session.duration_minutes} phút`}
                  >
                    <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-slate-500">
                      {start.getHours().toString().padStart(2, "0")}:
                      {start.getMinutes().toString().padStart(2, "0")}
                      <span
                        className="grid h-2.5 w-2.5 place-items-center rounded-sm text-[7px] font-bold text-white"
                        style={{ background: provider.color }}
                      >
                        {provider.glyph}
                      </span>
                    </div>
                    {!isShort && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-slate-800">
                        {session.title}
                      </div>
                    )}
                    {!isShort && session.teacher && (
                      <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wide text-slate-400">
                        {session.teacher.display_name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
