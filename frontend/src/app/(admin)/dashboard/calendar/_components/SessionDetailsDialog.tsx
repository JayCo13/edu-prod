"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  Calendar,
  Clock,
  User,
  BookOpen,
  AlignLeft,
  Link as LinkIcon,
  XCircle,
  ExternalLink,
  Pin,
  Sparkles,
  Pencil,
  Save,
  RotateCcw,
  Loader2,
  Ban,
} from "lucide-react";

import type { TeacherSessionRow } from "@/app/actions/live-sessions";
import { updateLiveSession } from "@/app/actions/live-sessions";
import type { TenantTeacherRow } from "@/types/database";

interface SessionDetailsDialogProps {
  session: TeacherSessionRow | null;
  onClose: () => void;
  /** Center admin. Edits any session in the tenant + can reassign teacher. */
  isAdmin: boolean;
  /** Caller's own teacher slot. Non-admins may edit only when this matches. */
  currentTeacherId: string | null;
  /** Teacher slot directory for the assignment dropdown (admin-only). */
  teachers: Pick<
    TenantTeacherRow,
    "id" | "display_name" | "color" | "is_admin"
  >[];
}

const VI_WEEKDAYS = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];
const VI_MONTHS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatLongDate(d: Date): string {
  return `${VI_WEEKDAYS[d.getDay()]}, ngày ${pad(d.getDate())} tháng ${VI_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

function formatTimeRange(start: Date, durationMin: number): string {
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} giờ`;
  return `${hours} giờ ${rest} phút`;
}

/** Convert an ISO string to the value shape `<input type="datetime-local">` expects. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Thứ Ba, 21/05/2026 · 17:30" — compact start-time preview shown beneath the input. */
function formatStartPreview(localValue: string): string {
  if (!localValue) return "";
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return "";
  return `${VI_WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "18:30" — computed end clock-time from a local input + duration. */
function computeEndClock(localValue: string, durationMin: number): string {
  if (!localValue) return "";
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + durationMin);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;

export default function SessionDetailsDialog({
  session,
  onClose,
  isAdmin,
  currentTeacherId,
  teachers,
}: SessionDetailsDialogProps) {
  // Non-admins can edit only their own session. RLS still enforces this
  // server-side; we use the same gate to drive the Edit / Hủy buổi buttons.
  const isOwnSession =
    !!session && !!currentTeacherId && session.teacher_id === currentTeacherId;
  const canEdit = isAdmin || isOwnSession;
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();

  // Edit-mode form state, hydrated from `session` whenever it opens or changes.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(60);
  const [teacherId, setTeacherId] = useState<string>("");

  useEffect(() => {
    if (!session) {
      setMode("view");
      return;
    }
    setTitle(session.title);
    setDescription(session.description ?? "");
    setStartLocal(isoToLocalInput(session.start_time));
    setDuration(session.duration_minutes);
    setTeacherId(session.teacher?.id ?? "");
  }, [session]);

  async function handleSave() {
    if (!session) return;
    if (!title.trim()) {
      toast.error("Tên buổi học không được để trống.");
      return;
    }
    startSaveTransition(async () => {
      const result = await updateLiveSession({
        id: session.id,
        title: title.trim(),
        description: description.trim(),
        start_time: new Date(startLocal).toISOString(),
        duration_minutes: duration,
        // Only admins can reassign the teacher slot — leave it untouched
        // for non-admins so they can't accidentally re-bind their session.
        ...(isAdmin ? { teacher_id: teacherId || null } : {}),
      });
      if (result.success) {
        toast.success("Đã lưu thay đổi.");
        setMode("view");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error || "Không thể lưu thay đổi.");
      }
    });
  }

  // Khi user bấm "Huỷ buổi" mở picker chọn lý do trước.
  // null = không mở. Khi user chọn xong → thực hiện huỷ với reason đó.
  type SessionCancelReason =
    | "BY_TEACHER"
    | "BY_CENTER"
    | "BY_STUDENT"
    | "FORCE_MAJEURE";

  function handleToggleCancelled() {
    if (!session) return;
    // Khôi phục (đang huỷ → bật lại) không cần lý do.
    if (session.is_cancelled) {
      runCancel(false, null);
      return;
    }
    // Bật huỷ → mở picker.
    setShowCancelPicker(true);
  }

  function runCancel(next: boolean, reason: SessionCancelReason | null) {
    if (!session) return;
    setShowCancelPicker(false);
    startSaveTransition(async () => {
      const result = await updateLiveSession({
        id: session.id,
        is_cancelled: next,
        cancellation_reason: reason,
      });
      if (result.success) {
        toast.success(next ? "Đã hủy buổi học." : "Đã khôi phục buổi học.");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error || "Không thể cập nhật trạng thái.");
      }
    });
  }

  const start = session ? new Date(session.start_time) : null;
  const teacherColor = session?.teacher?.color ?? "#6366f1";
  const isSeries = Boolean(session?.series_id);

  return (
    <AnimatePresence>
      {session && start && (
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        onClick={() => !isSaving && onClose()}
      >
        <motion.div
          key="dialog"
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Teacher-color accent band at the top */}
          <div className="h-1.5 w-full" style={{ background: teacherColor }} />

          {/* Hero header */}
          <div className="px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Chi tiết buổi học
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {mode === "view" ? (
              <h2
                className={`mt-2 text-2xl font-bold leading-tight tracking-tight ${
                  session.is_cancelled
                    ? "text-slate-400 line-through"
                    : "text-slate-900"
                }`}
              >
                {session.title}
              </h2>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên buổi học"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xl font-bold tracking-tight text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            )}

            {/* Status / kind chips row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {session.is_cancelled && (
                <Chip variant="rose" icon={<XCircle className="h-3 w-3" />}>
                  Đã hủy
                </Chip>
              )}
              {session.kind === "recurring" ? (
                <Chip variant="indigo" icon={<Pin className="h-3 w-3" />}>
                  Định kỳ
                  {session.recurrence_weeks
                    ? ` · ${session.recurrence_weeks} tuần`
                    : ""}
                </Chip>
              ) : (
                <Chip
                  variant="slate"
                  icon={<Sparkles className="h-3 w-3" />}
                >
                  Một lần
                </Chip>
              )}
              {isSeries && mode === "edit" && (
                <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-amber-700">
                  · Chỉ chỉnh sửa buổi này
                </span>
              )}
            </div>

            {/* Date / time block — prominent in view; richer form in edit. */}
            {mode === "view" ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  {formatLongDate(start)}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-sm tabular-nums text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {formatTimeRange(start, session.duration_minutes)}
                  <span className="text-xs text-slate-400">
                    ({formatDuration(session.duration_minutes)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                {/* Thời gian bắt đầu */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <label
                      htmlFor="session-edit-start"
                      className="text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Thời gian bắt đầu
                    </label>
                  </div>
                  <input
                    id="session-edit-start"
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base tabular-nums text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  {startLocal && (
                    <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-500">
                      {formatStartPreview(startLocal)}
                    </p>
                  )}
                </div>

                <div className="-mx-4 border-t border-slate-200/70" />

                {/* Thời lượng */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Thời lượng
                      </label>
                    </div>
                    {startLocal && (
                      <span className="font-mono text-[11px] tabular-nums text-slate-500">
                        Kết thúc lúc{" "}
                        <span className="font-semibold text-slate-700">
                          {computeEndClock(startLocal, duration)}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {DURATION_PRESETS.map((m) => {
                      const isActive = duration === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDuration(m)}
                          aria-pressed={isActive}
                          className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                            isActive
                              ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {m} phút
                        </button>
                      );
                    })}
                    <div className="ml-1 inline-flex items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Tùy chỉnh:
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={duration}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (Number.isFinite(v)) {
                            setDuration(Math.max(5, Math.min(480, v)));
                          }
                        }}
                        className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs tabular-nums text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        phút
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-3 px-6 pb-2 sm:grid-cols-2">
            <InfoCard
              icon={<BookOpen className="h-4 w-4 text-slate-400" />}
              label="Khóa học"
            >
              {session.course?.title ?? "—"}
            </InfoCard>

            <InfoCard
              icon={<User className="h-4 w-4 text-slate-400" />}
              label="Giáo viên"
            >
              {mode === "view" || !isAdmin ? (
                session.teacher ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: session.teacher.color }}
                      aria-hidden
                    />
                    {session.teacher.display_name}
                    {session.teacher.is_admin && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        · quản trị
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )
              ) : (
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">— Chưa phân công —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                      {t.is_admin ? " · quản trị" : ""}
                    </option>
                  ))}
                </select>
              )}
            </InfoCard>
          </div>

          {/* Description */}
          <div className="px-6 py-3">
            <div className="flex items-center gap-2">
              <AlignLeft className="h-3.5 w-3.5 text-slate-400" />
              <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                Mô tả
              </p>
            </div>
            {mode === "view" ? (
              session.description?.trim() ? (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {session.description}
                </p>
              ) : (
                <p className="mt-1.5 text-sm italic text-slate-400">
                  Không có mô tả.
                </p>
              )
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Mô tả buổi học (tùy chọn)"
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            )}
          </div>

          {/* Meeting URL (read-only, shown only for legacy sessions) */}
          {mode === "view" && session.meeting_url?.trim() && (
            <div className="border-t border-slate-100 px-6 py-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                  Đường dẫn (legacy)
                </p>
              </div>
              <a
                href={session.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 break-all text-sm text-indigo-600 hover:underline"
              >
                {session.meeting_url}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Footer / actions */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <div>
              {mode === "view" && canEdit && !session.is_cancelled && (
                <button
                  type="button"
                  onClick={handleToggleCancelled}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Hủy buổi
                </button>
              )}
              {mode === "view" && canEdit && session.is_cancelled && (
                <button
                  type="button"
                  onClick={handleToggleCancelled}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Khôi phục
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {mode === "view" ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Chỉnh sửa
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    disabled={isSaving}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}

      {/* Picker chọn lý do huỷ. Lý do quyết định lương có chi cho GV
          buổi đó không (PRD §5.8 + Migration 0036). */}
      {showCancelPicker && (
        <motion.div
          key="cancel-picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setShowCancelPicker(false)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 360 }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">
              Lý do huỷ buổi học
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Lý do quyết định buổi này có tính lương cho giáo viên hay
              không. Có thể đổi sau ở chi tiết buổi.
            </p>
            <div className="mt-4 space-y-2">
              <CancelReasonButton
                value="BY_TEACHER"
                label="Giáo viên chủ động huỷ / nghỉ"
                desc="GV xin nghỉ, đổi ca. Không tính lương buổi này."
                payHint="❌ Không trả"
                onPick={() => runCancel(true, "BY_TEACHER")}
              />
              <CancelReasonButton
                value="BY_CENTER"
                label="Lỗi từ trung tâm"
                desc="Phòng hỏng, xếp sai lịch, đóng cửa đột xuất. GV vẫn được trả lương."
                payHint="✓ Vẫn trả"
                onPick={() => runCancel(true, "BY_CENTER")}
                positive
              />
              <CancelReasonButton
                value="BY_STUDENT"
                label="Học viên vắng / huỷ"
                desc="Ít hoặc không có học viên tham gia. Mặc định không tính lương."
                payHint="❌ Không trả"
                onPick={() => runCancel(true, "BY_STUDENT")}
              />
              <CancelReasonButton
                value="FORCE_MAJEURE"
                label="Bất khả kháng"
                desc="Thiên tai, dịch bệnh, mất điện diện rộng. Mặc định vẫn trả lương."
                payHint="✓ Vẫn trả"
                onPick={() => runCancel(true, "FORCE_MAJEURE")}
                positive
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCancelPicker(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Quay lại
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Sub-component: nút chọn lý do huỷ ───────────────────────────────────

function CancelReasonButton({
  label,
  desc,
  payHint,
  positive,
  onPick,
}: {
  value: string;
  label: string;
  desc: string;
  payHint: string;
  positive?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            positive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
          }`}
        >
          {payHint}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{desc}</p>
    </button>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function Chip({
  children,
  icon,
  variant,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant: "indigo" | "rose" | "slate";
}) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-600",
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {icon}
      {children}
    </span>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}
