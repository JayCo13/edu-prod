"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, CalendarPlus, Clock, Download, ExternalLink, Video } from "lucide-react";
import type { StudentSessionRow } from "@/app/actions/live-sessions";
import { detectProvider } from "@/lib/meeting-provider";
import { ProviderBadge } from "@/components/calendar/ProviderBadge";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  type CalendarEvent,
} from "@/lib/calendar-export";

const REVEAL_BEFORE_MS = 15 * 60 * 1000; // unlock the join button 15 minutes early

interface StudentSessionCardProps {
  session: StudentSessionRow;
  tenantSlug: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0 phút";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes >= 1440) {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return `Còn ${days} ngày${hours ? ` ${hours} giờ` : ""}`;
  }
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `Còn ${hours} giờ${minutes ? ` ${minutes} phút` : ""}`;
  }
  return `Còn ${totalMinutes} phút`;
}

export function StudentSessionCard({
  session,
  tenantSlug,
}: StudentSessionCardProps) {
  const provider = detectProvider(session.meeting_url);
  const startTs = useMemo(
    () => new Date(session.start_time).getTime(),
    [session.start_time],
  );
  const endTs = startTs + session.duration_minutes * 60 * 1000;

  // Tick every 30s — fine-grained enough for the countdown without being noisy.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const isLive = now >= startTs && now <= endTs;
  const isEnded = now > endTs;
  const isUnlocked = now >= startTs - REVEAL_BEFORE_MS;
  const courseSlug = session.course?.slug;

  const calendarEvent: CalendarEvent = useMemo(
    () => ({
      uid: session.id,
      title: session.title,
      startIso: session.start_time,
      durationMinutes: session.duration_minutes,
      description: session.course?.title
        ? `Khóa học: ${session.course.title}`
        : undefined,
      meetingUrl: session.meeting_url,
    }),
    [
      session.id,
      session.title,
      session.start_time,
      session.duration_minutes,
      session.course?.title,
      session.meeting_url,
    ],
  );
  const googleCalendarUrl = useMemo(
    () => buildGoogleCalendarUrl(calendarEvent),
    [calendarEvent],
  );

  const cta = isEnded ? null : isLive ? (
    <a
      href={session.meeting_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      Tham gia ngay
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  ) : isUnlocked ? (
    <a
      href={session.meeting_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      Vào phòng họp
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  ) : (
    <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-wide text-slate-500">
      {formatCountdown(startTs - now)}
    </span>
  );

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-white px-5 py-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center ${
        isLive ? "border-rose-200" : "border-slate-200"
      }`}
    >
      <div
        className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${
          isLive ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-700"
        }`}
      >
        <Video className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-slate-900">
            {session.title}
          </h3>
          <ProviderBadge provider={provider} size="sm" />
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-rose-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
              Đang diễn ra
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateTime(session.start_time)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {session.duration_minutes} phút
          </span>
          {session.course?.title && (
            <span className="truncate">· {session.course.title}</span>
          )}
        </div>
        {courseSlug && !isEnded && (
          <Link
            href={`/learn/${courseSlug}/live/${session.id}`}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-700"
          >
            Mở phòng chờ →
          </Link>
        )}
        {!isEnded && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Thêm vào lịch:
            </span>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              title="Thêm vào Google Calendar"
            >
              <CalendarPlus className="h-3 w-3" />
              Google Calendar
            </a>
            <button
              type="button"
              onClick={() => downloadIcsFile(calendarEvent)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              title="Tải file .ics (Apple Calendar, Outlook, …)"
            >
              <Download className="h-3 w-3" />
              .ics
            </button>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">{cta}</div>
    </article>
  );
}
