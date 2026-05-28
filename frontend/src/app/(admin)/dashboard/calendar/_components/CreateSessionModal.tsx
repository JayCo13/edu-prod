"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  X,
  Loader2,
  Calendar,
  Clock,
  User,
  Pin,
  Sparkles,
  StickyNote,
} from "lucide-react";

import type {
  CourseRow,
  LiveSessionKind,
  TenantTeacherRow,
} from "@/types/database";
import { scheduleLiveSession } from "@/app/actions/live-sessions";

/**
 * CreateSessionModal
 * ==================
 * Modal form for teachers to schedule a new live session.
 */

const VI_WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format a datetime-local input value as "T3 21/05/2026". Returns "" if blank. */
function formatPreviewDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return `${VI_WEEKDAYS_SHORT[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Returns the same datetime-local string shifted by N weeks. */
function addWeeks(value: string, weeks: number): string {
  if (!value) return "";
  const d = new Date(value);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString();
}

interface CreateSessionModalProps {
  courses: Pick<CourseRow, "id" | "title">[];
  teachers: Pick<
    TenantTeacherRow,
    "id" | "display_name" | "color" | "is_admin"
  >[];
  /** Caller's own slot id; used as the default and the lock target for non-admins. */
  currentTeacherId: string | null;
  /** Admin can pick any teacher; non-admin is locked to their own slot. */
  isAdmin: boolean;
}

export default function CreateSessionModal({
  courses,
  teachers,
  currentTeacherId,
  isAdmin,
}: CreateSessionModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Sidebar's "Tạo buổi học Live" quick-action navigates with ?create=1 —
  // start opened on first mount when that param is present.
  const [isOpen, setIsOpen] = useState(
    () => searchParams.get("create") === "1",
  );
  const [isCreating, startCreateTransition] = useTransition();

  // Strip the ?create=1 param after first mount so a refresh / back doesn't
  // reopen the modal. Only fires when the param is actually present, so this
  // doesn't churn the URL on normal page loads.
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("create");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Form state
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState<string>(
    () => currentTeacherId ?? teachers[0]?.id ?? "",
  );
  // Classification: 'recurring' = định kỳ (long-term), 'one_off' = một lần (one-time).
  // Default to one-off — admins explicitly opt into the long-term tag.
  const [kind, setKind] = useState<LiveSessionKind>("one_off");
  // Span (in weeks) when kind='recurring'. 12 weeks ≈ a 3-month VN cram cycle.
  const [recurrenceWeeks, setRecurrenceWeeks] = useState<number>(12);

  // Show the picker only when the tenant has more than one slot. Otherwise
  // teacherId is auto-set to the only option (or the caller).
  const showTeacherPicker = teachers.length > 1;

  function resetForm() {
    setTitle("");
    setCourseId("");
    setStartTime("");
    setDuration(60);
    setDescription("");
    setTeacherId(currentTeacherId ?? teachers[0]?.id ?? "");
    setKind("one_off");
    setRecurrenceWeeks(12);
  }

  function handleSubmit() {
    if (!title.trim() || !startTime) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    startCreateTransition(async () => {
      const result = await scheduleLiveSession({
        title: title.trim(),
        course_id: courseId || null,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: duration,
        meeting_url: "",
        meeting_password: null,
        description: description.trim(),
        teacher_id: teacherId || null,
        kind,
        recurrence_weeks: kind === "recurring" ? recurrenceWeeks : null,
      });

      if (result.success) {
        toast.success(
          kind === "recurring"
            ? `Đã tạo ${recurrenceWeeks} buổi học định kỳ!`
            : "Đã tạo lịch học thành công!",
        );
        resetForm();
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Không thể tạo lịch học.");
      }
    });
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Tạo buổi học
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !isCreating && setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Tạo buổi học
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isCreating}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Two-column body: scheduling on the left, classification + note
                  on the right. Stacks to one column on small screens. Body
                  scrolls so the modal never exceeds 90vh. */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  {/* ── LEFT: Thông tin buổi học ──────────────────────── */}
                  <section className="space-y-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Thông tin buổi học
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tên, khóa học, giáo viên và thời gian.
                      </p>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Calendar className="h-3.5 w-3.5" />
                        Tên buổi học *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ví dụ: Ôn tập Writing Task 2"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    {/* Course — optional. Legacy model retiring in favour of
                        classes (PRD §6, not yet shipped). */}
                    {courses.length > 0 && (
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                          <span>Khóa học</span>
                          <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                            (tùy chọn)
                          </span>
                        </label>
                        <select
                          value={courseId}
                          onChange={(e) => setCourseId(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">— Không liên kết khóa học —</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Teacher picker — only shown for tenants with >1 slot */}
                    {showTeacherPicker && (
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <User className="h-3.5 w-3.5" />
                          Giáo viên *
                          {!isAdmin && (
                            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                              (chỉ có thể chọn của mình)
                            </span>
                          )}
                        </label>
                        <select
                          value={teacherId}
                          onChange={(e) => setTeacherId(e.target.value)}
                          disabled={!isAdmin}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.display_name}
                              {t.is_admin ? " · quản trị" : ""}
                              {t.id === currentTeacherId ? " · (bạn)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Start Time + Duration Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Clock className="h-3.5 w-3.5" />
                          Thời gian bắt đầu *
                        </label>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 text-xs font-medium text-slate-600">
                          Thời lượng (phút)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={480}
                          value={duration}
                          onChange={(e) =>
                            setDuration(
                              Math.max(5, parseInt(e.target.value) || 60),
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                  </section>

                  {/* ── RIGHT: Loại & ghi chú ─────────────────────────── */}
                  <section className="space-y-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Loại & ghi chú
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Lặp lại hay một lần, và lưu ý dành cho giáo viên.
                      </p>
                    </div>

                    {/* Kind — recurring vs one-off classification */}
                    <div>
                      <label className="mb-1.5 text-xs font-medium text-slate-600">
                        Loại buổi học *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            {
                              id: "recurring",
                              label: "Định kỳ",
                              hint: "Lặp lại lâu dài",
                              icon: Pin,
                            },
                            {
                              id: "one_off",
                              label: "Một lần",
                              hint: "Buổi đơn lẻ",
                              icon: Sparkles,
                            },
                          ] as const
                        ).map((opt) => {
                          const isActive = kind === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setKind(opt.id)}
                              className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                isActive
                                  ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                              aria-pressed={isActive}
                            >
                              <opt.icon
                                className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                                  isActive
                                    ? "text-indigo-600"
                                    : "text-slate-400"
                                }`}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-semibold ${
                                    isActive
                                      ? "text-indigo-900"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {opt.label}
                                </div>
                                <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                                  {opt.hint}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Weeks picker — revealed only when 'Định kỳ' is chosen */}
                      {kind === "recurring" && (
                        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-3">
                          <label className="text-xs font-semibold text-indigo-900">
                            Lặp lại trong bao nhiêu tuần?
                          </label>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {[4, 8, 12, 16, 24].map((w) => {
                              const isActive = recurrenceWeeks === w;
                              return (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() => setRecurrenceWeeks(w)}
                                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                                    isActive
                                      ? "border-indigo-400 bg-indigo-600 text-white shadow-sm"
                                      : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                                  }`}
                                >
                                  {w} tuần
                                </button>
                              );
                            })}
                            <div className="ml-1 inline-flex items-center gap-1.5">
                              <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                                Tùy chỉnh:
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={52}
                                value={recurrenceWeeks}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  if (Number.isFinite(v)) {
                                    setRecurrenceWeeks(
                                      Math.max(1, Math.min(52, v)),
                                    );
                                  }
                                }}
                                className="w-16 rounded-md border border-indigo-200 bg-white px-2 py-1 text-center font-mono text-xs tabular-nums text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-indigo-900/80">
                            {startTime ? (
                              <>
                                Sẽ tạo <b>{recurrenceWeeks} buổi</b> cùng giờ,
                                hàng tuần từ{" "}
                                <span className="font-mono tabular-nums">
                                  {formatPreviewDate(startTime)}
                                </span>{" "}
                                đến{" "}
                                <span className="font-mono tabular-nums">
                                  {formatPreviewDate(
                                    addWeeks(startTime, recurrenceWeeks - 1),
                                  )}
                                </span>
                                .
                              </>
                            ) : (
                              <>Chọn thời gian bắt đầu để xem dải ngày.</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ghi chú cho giáo viên — admin's note for THIS session.
                        Stored in live_sessions.description (one row per
                        session). For recurring series this becomes the
                        starting note on every instance — admin can edit each
                        individually via the details dialog. */}
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <StickyNote className="h-3.5 w-3.5" />
                          {isAdmin
                            ? "Ghi chú cho giáo viên (buổi này)"
                            : "Ghi chú buổi học"}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                          (tùy chọn)
                        </span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        placeholder={
                          isAdmin
                            ? "Ví dụ: Trọng tâm Writing Task 2; chấm bài về nhà tuần trước; chuẩn bị Cambridge IELTS 18 trang 42."
                            : "Ghi chú ngắn về buổi học (tài liệu, trọng tâm, lưu ý…)."
                        }
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <div className="mt-1 flex items-start justify-between gap-3">
                        {kind === "recurring" ? (
                          <p className="text-[11px] leading-snug text-slate-500">
                            Ghi chú này sẽ áp dụng cho cả{" "}
                            <span className="font-semibold text-slate-700">
                              {recurrenceWeeks} buổi
                            </span>
                            . Bạn có thể chỉnh ghi chú riêng cho từng buổi sau
                            khi tạo — mở chi tiết buổi rồi bấm{" "}
                            <span className="font-semibold text-slate-700">
                              Chỉnh sửa
                            </span>
                            .
                          </p>
                        ) : (
                          <p className="text-[11px] leading-snug text-slate-500">
                            Ghi chú chỉ áp dụng cho buổi này. Có thể chỉnh sửa
                            sau từ chi tiết buổi.
                          </p>
                        )}
                        <p className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                          {description.length}/1000
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isCreating}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    "Tạo lịch học"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
