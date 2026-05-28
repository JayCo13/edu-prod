"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Calendar,
  CalendarPlus,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pin,
  Trash2,
  Users,
  Video,
} from "lucide-react";

import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import { deleteLiveSession } from "@/app/actions/live-sessions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { detectProvider } from "@/lib/meeting-provider";
import { ProviderBadge } from "@/components/calendar/ProviderBadge";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  type CalendarEvent,
} from "@/lib/calendar-export";

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

interface SessionListProps {
  sessions: TeacherSessionRow[];
}

type SessionState = "upcoming" | "live" | "ended" | "cancelled";

function getSessionState(s: TeacherSessionRow): SessionState {
  if (s.is_cancelled) return "cancelled";
  const now = Date.now();
  const start = new Date(s.start_time).getTime();
  const end = start + s.duration_minutes * 60 * 1000;
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  return "ended";
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.slice(0, max - u.hostname.length - 3)}…`;
  } catch {
    return url.slice(0, max - 1) + "…";
  }
}

interface SessionRowProps {
  session: TeacherSessionRow;
  state: SessionState;
  onCopy: (url: string) => void;
  onDelete: (id: string, title: string) => void;
  isDeleting: boolean;
}

function SessionRow({ session, state, onCopy, onDelete, isDeleting }: SessionRowProps) {
  const provider = detectProvider(session.meeting_url);
  const enrollmentCount = session.course?.enrollments_count ?? 0;

  const stateBadge =
    state === "live" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-rose-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        Đang diễn ra
      </span>
    ) : state === "upcoming" ? (
      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-medium text-indigo-600">
        Sắp tới
      </span>
    ) : state === "cancelled" ? (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
        Đã hủy
      </span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
        Đã kết thúc
      </span>
    );

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-4 ${
        state === "live" ? "border-rose-200" : "border-slate-100"
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
          state === "live" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
        }`}
      >
        <Video className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {session.title}
          </p>
          {stateBadge}
          {session.kind === "recurring" && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-medium text-indigo-700"
              title="Buổi học định kỳ — lặp lại lâu dài"
            >
              <Pin className="h-3 w-3" />
              Định kỳ
            </span>
          )}
          <ProviderBadge provider={provider} size="sm" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateTime(session.start_time)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {session.duration_minutes} phút
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {enrollmentCount.toLocaleString("vi-VN")} học viên sẽ nhận link
          </span>
          {session.course?.title && (
            <span className="truncate text-slate-400">
              · {session.course.title}
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate font-mono text-[10.5px] text-slate-400">
          {truncateUrl(session.meeting_url)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:flex-shrink-0">
        {state === "live" && (
          <a
            href={session.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Tham gia ngay
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onCopy(session.meeting_url)}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="Sao chép link phòng họp"
        >
          <Copy className="h-4 w-4" />
        </button>
        {state !== "live" && (
          <a
            href={session.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            title="Mở phòng họp"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {state !== "ended" && (
          <>
            <a
              href={buildGoogleCalendarUrl(sessionToCalendarEvent(session))}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="Thêm vào Google Calendar"
            >
              <CalendarPlus className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() =>
                downloadIcsFile(sessionToCalendarEvent(session))
              }
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="Tải file .ics (Apple Calendar, Outlook, …)"
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onDelete(session.id, session.title)}
          disabled={isDeleting}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Xóa buổi học"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

interface GroupHeaderProps {
  label: string;
  count: number;
}

function GroupHeader({ label, count }: GroupHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </h2>
      <span className="font-mono text-[10px] text-slate-400 tabular-nums">
        {count}
      </span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

export default function SessionList({ sessions }: SessionListProps) {
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();

  function handleCopy(url: string) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Đã sao chép link phòng họp"))
      .catch(() => toast.error("Không thể sao chép. Vui lòng thử lại."));
  }

  async function handleDelete(sessionId: string, title: string) {
    const ok = await confirm({
      title: `Xoá buổi học "${title}"?`,
      variant: "danger",
      confirmLabel: "Xoá buổi học",
      description:
        "Buổi học này sẽ bị xoá khỏi lịch. Hành động này không thể hoàn tác.",
    });
    if (!ok) return;
    startDeleteTransition(async () => {
      const result = await deleteLiveSession(sessionId);
      if (result.success) {
        toast.success("Đã xóa buổi học.");
        router.refresh();
      } else {
        toast.error(result.error || "Không thể xóa.");
      }
    });
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16">
        <div className="mb-4 rounded-full bg-slate-100 p-4">
          <Video className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">
          Chưa có buổi học nào được lên lịch
        </p>
        <p className="mt-1 max-w-sm text-center text-xs text-slate-400">
          Tạo phòng họp bằng tài khoản Zoom / Google Meet / Teams của bạn, sau
          đó nhấn &quot;Tạo buổi học Live&quot; để dán link và lên lịch.
        </p>
      </div>
    );
  }

  // Group by upcoming/live vs ended/cancelled, then sort within each group.
  const live: TeacherSessionRow[] = [];
  const upcoming: TeacherSessionRow[] = [];
  const past: TeacherSessionRow[] = [];
  for (const s of sessions) {
    const state = getSessionState(s);
    if (state === "live") live.push(s);
    else if (state === "upcoming") upcoming.push(s);
    else past.push(s);
  }
  // upcoming: nearest first (already ascending from server). past: newest first.
  past.reverse();

  const renderGroup = (
    label: string,
    list: TeacherSessionRow[],
    keyPrefix: string,
  ) => {
    if (list.length === 0) return null;
    return (
      <section className="space-y-2.5">
        <GroupHeader label={label} count={list.length} />
        {list.map((session, i) => (
          <motion.div
            key={`${keyPrefix}-${session.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <SessionRow
              session={session}
              state={getSessionState(session)}
              onCopy={handleCopy}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          </motion.div>
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {renderGroup("Đang diễn ra", live, "live")}
      {renderGroup("Sắp tới", upcoming, "upcoming")}
      {renderGroup("Đã kết thúc", past, "past")}
    </div>
  );
}
