"use client";

import { useEffect, useMemo, useState } from "react";
import { Pin } from "lucide-react";
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
  /** Fired when a session card is clicked. Opens the details dialog. */
  onSelectSession?: (session: TeacherSessionRow) => void;
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

export default function WeekView({
  sessions,
  weekStart,
  onSelectSession,
}: WeekViewProps) {
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

  // "Now" indicator — updates every minute. Drawn as a red horizontal line
  // spanning today's column inside the grid, plus a dot in the time gutter.
  // Only visible when today falls inside the rendered week AND now is in
  // the visible hour band.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const todayIndexInWeek = days.findIndex((d) => isSameDay(d, now));
  const nowMinutesFromGridTop =
    (now.getHours() - VIEW_START_HOUR) * 60 + now.getMinutes();
  const nowVisible =
    todayIndexInWeek !== -1 &&
    nowMinutesFromGridTop >= 0 &&
    nowMinutesFromGridTop <= VISIBLE_HOURS * 60;
  const nowTopPx = (nowMinutesFromGridTop / 60) * HOUR_HEIGHT;

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

      {/* Day-of-week header row — Google-Calendar style: weekday label
          above a big day number, with today wearing a filled indigo pill. */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-100 bg-white text-center">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className="flex flex-col items-center gap-1 border-l border-slate-100 px-2 py-2"
            >
              <div
                className={`font-mono text-[10px] uppercase tracking-wide ${
                  isToday ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                {VI_WEEKDAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]}
              </div>
              {isToday ? (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm">
                  {d.getDate()}
                </div>
              ) : (
                <div className="text-sm font-semibold text-slate-700">
                  {d.getDate()}
                  <span className="font-normal text-slate-400">
                    /{d.getMonth() + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
        {/* Time-band wash layer — single layer covering the 7 day columns
            only (skips the 56px hour gutter). Sits in DOM before the columns
            so column borders & today-highlight paint on top, keeping dividers
            visible even where band color (e.g. Đêm slate) matches the
            divider color. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{ left: 56 }}
          aria-hidden
        >
          {TIME_BANDS.map((b) => {
            const top = (b.startHour - VIEW_START_HOUR) * HOUR_HEIGHT;
            const height = (b.endHour - b.startHour) * HOUR_HEIGHT;
            return (
              <div
                key={b.id}
                className={`absolute left-0 right-0 ${b.bg}`}
                style={{ top, height }}
              />
            );
          })}
        </div>

        {/* Hour-label gutter */}
        <div className="relative border-r border-slate-200 bg-white">
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
              className={`relative border-l border-slate-200 ${isToday ? "bg-indigo-50/30" : ""}`}
              style={{ height: VISIBLE_HOURS * HOUR_HEIGHT }}
            >
              {/* Hour grid lines — slate-200 so they stay visible across
                  every time-band wash (Đêm uses bg-slate-100, which would
                  otherwise hide slate-100 lines). */}
              {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute left-0 right-0 border-t border-slate-200"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {/* "Now" indicator — only inside today's column. Red line with
                  a dot anchor on the left edge, matching Google Calendar. */}
              {isToday && nowVisible && (
                <>
                  <div
                    className="pointer-events-none absolute -left-1 z-20 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm"
                    style={{ top: nowTopPx - 5 }}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500"
                    style={{ top: nowTopPx }}
                    aria-label={`Bây giờ ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`}
                  />
                </>
              )}

              {/* Session cards — Google-Calendar style: tinted background
                  derived from the teacher's color so the eye groups by
                  teacher; thick coloured left edge; time range visible at a
                  glance; cancelled ones flatten to muted slate. */}
              {sessionsByDay[dayIdx].map(({ session, topPx, heightPx }) => {
                const provider = detectProvider(session.meeting_url);
                const start = new Date(session.start_time);
                const end = new Date(
                  start.getTime() + session.duration_minutes * 60_000,
                );
                const isCancelled = session.is_cancelled;
                const isShort = heightPx < 48;
                const teacherColor = session.teacher?.color ?? provider.color;
                const cardStyle: React.CSSProperties = isCancelled
                  ? {
                      top: topPx,
                      height: heightPx,
                      borderLeftWidth: 3,
                      borderLeftColor: "#cbd5e1",
                    }
                  : {
                      top: topPx,
                      height: heightPx,
                      borderLeftWidth: 3,
                      borderLeftColor: teacherColor,
                      background: `${teacherColor}14`,
                    };
                const fmt = (d: Date) =>
                  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession?.(session)}
                    className={`group absolute left-1 right-1 overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] shadow-sm transition-all hover:z-10 hover:shadow-md hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                      isCancelled
                        ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                        : "border-slate-200/80 text-slate-800"
                    }`}
                    style={cardStyle}
                    title={`${session.title}${session.teacher ? ` · ${session.teacher.display_name}` : ""} · ${fmt(start)}–${fmt(end)}`}
                  >
                    <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-slate-600">
                      <span className="truncate">
                        {fmt(start)}–{fmt(end)}
                      </span>
                      <span
                        className="ml-auto grid h-2.5 w-2.5 place-items-center rounded-sm text-[7px] font-bold text-white"
                        style={{ background: provider.color }}
                      >
                        {provider.glyph}
                      </span>
                      {session.kind === "recurring" && (
                        <Pin
                          className="h-2.5 w-2.5 text-indigo-500"
                          aria-label="Buổi định kỳ"
                        />
                      )}
                    </div>
                    {!isShort && (
                      <div
                        className={`mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight ${
                          isCancelled ? "text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {session.title}
                      </div>
                    )}
                    {!isShort && session.teacher && (
                      <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[9px] uppercase tracking-wide text-slate-500">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: teacherColor }}
                          aria-hidden
                        />
                        {session.teacher.display_name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
