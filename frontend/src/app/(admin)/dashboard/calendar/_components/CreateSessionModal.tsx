"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  X,
  Loader2,
  Video,
  Calendar,
  Clock,
  Link as LinkIcon,
  Lock,
  ExternalLink,
  AlertTriangle,
  User,
} from "lucide-react";

import type { CourseRow, TenantTeacherRow } from "@/types/database";
import { scheduleLiveSession } from "@/app/actions/live-sessions";
import {
  detectProvider,
  extractZoomPassword,
  listKnownProviders,
} from "@/lib/meeting-provider";
import { ProviderBadge } from "@/components/calendar/ProviderBadge";

/**
 * CreateSessionModal
 * ==================
 * Modal form for teachers to schedule a new live session.
 */

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
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingPassword, setMeetingPassword] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState<string>(
    () => currentTeacherId ?? teachers[0]?.id ?? "",
  );

  // Show the picker only when the tenant has more than one slot. Otherwise
  // teacherId is auto-set to the only option (or the caller).
  const showTeacherPicker = teachers.length > 1;

  function resetForm() {
    setTitle("");
    setCourseId("");
    setStartTime("");
    setDuration(60);
    setMeetingUrl("");
    setMeetingPassword("");
    setDescription("");
    setTeacherId(currentTeacherId ?? teachers[0]?.id ?? "");
  }

  // Live provider detection from the URL field. "other" until URL is parseable.
  const detected = useMemo(() => detectProvider(meetingUrl), [meetingUrl]);
  const knownProviders = listKnownProviders();

  // Auto-pull pwd from a Zoom URL on paste, but never overwrite a value the
  // teacher already typed.
  function handleUrlChange(value: string) {
    setMeetingUrl(value);
    if (!meetingPassword) {
      const fromUrl = extractZoomPassword(value);
      if (fromUrl) setMeetingPassword(fromUrl);
    }
  }

  function handleSubmit() {
    if (!title.trim() || !courseId || !startTime || !meetingUrl.trim()) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    startCreateTransition(async () => {
      const result = await scheduleLiveSession({
        title: title.trim(),
        course_id: courseId,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: duration,
        meeting_url: meetingUrl.trim(),
        meeting_password: meetingPassword.trim() || null,
        description: description.trim(),
        teacher_id: teacherId || null,
      });

      if (result.success) {
        toast.success("Đã tạo lịch học thành công!");
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
        Tạo buổi học Live
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
              className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Tạo buổi học Live
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

              {/* Form */}
              <div className="space-y-4 px-6 py-5">
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

                {/* Course */}
                <div>
                  <label className="mb-1.5 text-xs font-medium text-slate-600">
                    Khóa học *
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Chọn khóa học...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teacher picker — only shown for tenants with >1 teacher slot */}
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
                        setDuration(Math.max(5, parseInt(e.target.value) || 60))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {/* Meeting URL — BYOM: teacher pastes a link from their own
                    Zoom/Meet/Teams account. We only detect the provider for
                    a clean badge; we never create rooms. */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <LinkIcon className="h-3.5 w-3.5" />
                      Đường dẫn phòng học *
                    </label>
                    {meetingUrl.trim().length > 0 && (
                      <ProviderBadge provider={detected} size="sm" />
                    )}
                  </div>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="Dán link từ Zoom / Google Meet / Teams / ..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  {meetingUrl.trim().length > 0 && detected.id === "other" && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700">
                      <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
                      Không nhận diện được nền tảng họp (Zoom / Meet / Teams /
                      Jitsi…). Hãy kiểm tra lại đường dẫn — bạn vẫn có thể lưu
                      nếu đây là link đúng.
                    </p>
                  )}
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Tạo phòng họp bằng tài khoản của bạn rồi dán đường dẫn
                      vào đây. Học viên đã đăng ký khóa học sẽ nhận link tự
                      động trước giờ học.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Tạo nhanh:
                      </span>
                      {knownProviders.map((p) => (
                        <a
                          key={p.id}
                          href={p.scheduleUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                          title={`Mở ${p.label} trong tab mới`}
                        >
                          <span
                            className="grid h-3 w-3 place-items-center rounded-sm text-[8px] font-bold text-white"
                            style={{ background: p.color }}
                          >
                            {p.glyph}
                          </span>
                          {p.label}
                          <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Meeting Password */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Lock className="h-3.5 w-3.5" />
                    Mật khẩu phòng (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={meetingPassword}
                    onChange={(e) => setMeetingPassword(e.target.value)}
                    placeholder="Để trống nếu không có"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
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
