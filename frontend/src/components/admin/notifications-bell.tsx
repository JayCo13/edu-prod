"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarPlus,
  Pencil,
  Ban,
  Check,
  CheckCheck,
  Inbox,
} from "lucide-react";

import type { NotificationKind, NotificationRow } from "@/types/database";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";

/**
 * NotificationsBell
 * =================
 * Top-nav bell with unread dot, dropdown list, and mark-read actions.
 * Polls every 30s while the page is focused; refetches immediately when the
 * dropdown opens. RLS scopes rows to the signed-in user.
 */

const POLL_MS = 30_000;

const KIND_META: Record<
  NotificationKind,
  { icon: typeof CalendarPlus; tone: string }
> = {
  session_created: { icon: CalendarPlus, tone: "text-emerald-600" },
  session_updated: { icon: Pencil, tone: "text-amber-600" },
  session_cancelled: { icon: Ban, tone: "text-rose-600" },
};

const VI_RELATIVE = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d} ngày trước`;
  // Fall back to absolute date in dd/mm format for older items
  const date = new Date(iso);
  return `${date.getDate().toString().padStart(2, "0")}/${(
    date.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}`;
};

function formatVerb(kind: NotificationKind): string {
  switch (kind) {
    case "session_created":
      return "đã tạo buổi học";
    case "session_updated":
      return "đã chỉnh sửa buổi học";
    case "session_cancelled":
      return "đã huỷ buổi học";
  }
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function NotificationsBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [isMutating, startMutation] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  async function refetch() {
    const result = await listMyNotifications();
    if (result.success && result.data) setItems(result.data);
  }

  // Initial load + interval poll. Pauses when the tab is hidden so we don't
  // burn battery on a background dashboard.
  useEffect(() => {
    refetch();
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (timer) return;
      timer = setInterval(refetch, POLL_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refetch();
        start();
      } else {
        stop();
      }
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Refresh as soon as the dropdown opens so the bell never shows a stale list.
  useEffect(() => {
    if (isOpen) refetch();
  }, [isOpen]);

  // Click-outside + Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  function handleItemClick(n: NotificationRow) {
    // Optimistic mark-read; the action also clears unread state server-side.
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r,
        ),
      );
      startMutation(async () => {
        await markNotificationRead(n.id);
      });
    }
    // Navigate to the calendar so the admin lands somewhere actionable. The
    // session list is the obvious entry; deep-linking to a specific session
    // dialog is a future polish.
    if (n.entity_type === "live_session") {
      router.push("/dashboard/calendar");
      setIsOpen(false);
    }
  }

  function handleMarkAll() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
    startMutation(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Thông báo"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 font-mono text-[10px] font-bold tabular-nums text-white shadow-sm">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute right-0 top-11 z-50 w-[22rem] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  Thông báo
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {unread > 0 ? `${unread} chưa đọc` : "Đã đọc tất cả"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={unread === 0 || isMutating}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đánh dấu đã đọc
              </button>
            </div>

            {/* List */}
            <div className="max-h-[28rem] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-slate-400">
                  <Inbox className="h-8 w-8" />
                  <p className="text-sm">Chưa có thông báo nào.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {items.map((n) => {
                    const meta = KIND_META[n.kind];
                    const Icon = meta.icon;
                    const isUnread = !n.read_at;
                    const actor =
                      n.payload.actor_display_name?.trim() || "Giáo viên";
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                            isUnread ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 ${meta.tone}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug text-slate-800">
                              <span className="font-semibold">{actor}</span>{" "}
                              {formatVerb(n.kind)}
                              {n.payload.series_count
                                ? ` (${n.payload.series_count} buổi định kỳ)`
                                : ""}
                              :
                            </p>
                            <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
                              {n.payload.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] tabular-nums text-slate-400">
                              <span>{formatSessionTime(n.payload.start_time)}</span>
                              {n.payload.course_title && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">
                                    {n.payload.course_title}
                                  </span>
                                </>
                              )}
                              <span className="ml-auto whitespace-nowrap">
                                {VI_RELATIVE(n.created_at)}
                              </span>
                            </div>
                          </div>
                          {isUnread && (
                            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                          )}
                          {!isUnread && (
                            <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
