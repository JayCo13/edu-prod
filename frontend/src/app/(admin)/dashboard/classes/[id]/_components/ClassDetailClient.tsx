"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Pencil,
  Receipt,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import AddStudentsModal from "./AddStudentsModal";
import BulkSessionsModal from "./BulkSessionsModal";
import BulkPaymentsModal from "./BulkPaymentsModal";
import BulkEditSessionsModal from "./BulkEditSessionsModal";
import TeachersTab from "./TeachersTab";

import {
  createClassSession,
  deleteClassSession,
  getClassSessionCount,
  listClasses,
  listSessionsForClass,
  type ClassRow,
  type ClassSessionRow,
} from "@/modules/classes/actions";
import {
  listAttendanceForSession,
  listEnrollments,
  listStudents,
  markAttendance,
  monthlyAttendanceReport,
  transferStudent,
  withdrawEnrollment,
} from "@/modules/students/actions";
import type {
  AttendanceStatus,
  MonthlyAttendanceStat,
  StudentRow,
} from "@/modules/students/types";

interface Props {
  classId: string;
  className: string;
}

interface StudentInClass extends StudentRow {
  enrollment_id: string;
  enrolled_at: string;
  tuition_amount_vnd: number | null;
}

export default function ClassDetailClient({ classId, className }: Props) {
  const [tab, setTab] = useState<"students" | "teachers" | "sessions" | "attendance">("students");
  const [students, setStudents] = useState<StudentInClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferOf, setTransferOf] = useState<StudentInClass | null>(null);
  const [withdrawOf, setWithdrawOf] = useState<StudentInClass | null>(null);
  const [addingStudents, setAddingStudents] = useState(false);
  const [bulkPaymentsOpen, setBulkPaymentsOpen] = useState(false);
  const [reload, setReload] = useState(0);

  const existingStudentIds = useMemo(
    () => new Set(students.map((s) => s.id)),
    [students],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [enrRes, stuRes] = await Promise.all([
        listEnrollments({ classId, status: "ACTIVE" }),
        listStudents({ classId }),
      ]);
      if (cancelled) return;
      const enrs = enrRes.success ? enrRes.data : [];
      const stus = stuRes.success ? stuRes.data : [];
      const stuById = new Map(stus.map((s) => [s.id, s]));
      const merged: StudentInClass[] = enrs
        .filter((e) => stuById.has(e.student_id))
        .map((e) => {
          const s = stuById.get(e.student_id)!;
          return {
            ...s,
            enrollment_id: e.id,
            enrolled_at: e.enrolled_at,
            tuition_amount_vnd: e.tuition_amount_vnd,
          };
        });
      merged.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setStudents(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, reload]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("students")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "students" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Users className="mr-1 inline h-3.5 w-3.5" />
          Học sinh ({students.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("teachers")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "teachers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <GraduationCap className="mr-1 inline h-3.5 w-3.5" />
          Giáo viên
        </button>
        <button
          type="button"
          onClick={() => setTab("sessions")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "sessions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <CalendarPlus className="mr-1 inline h-3.5 w-3.5" />
          Buổi học & Điểm danh
        </button>
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "attendance" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <CalendarCheck className="mr-1 inline h-3.5 w-3.5" />
          Báo cáo tháng
        </button>
      </div>

      {tab === "students" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {students.length === 0
                ? "Lớp chưa có học sinh."
                : `${students.length} học sinh đang theo học`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setBulkPaymentsOpen(true)}
                disabled={students.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Receipt className="h-3.5 w-3.5" />
                Tạo khoản thu hàng tháng
              </button>
              <button
                type="button"
                onClick={() => setAddingStudents(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Thêm học sinh
              </button>
            </div>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
              Đang tải…
            </p>
          ) : students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                Chưa có học sinh nào trong lớp.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Bấm <strong>Thêm học sinh</strong> để chọn từ danh sách (có
                thể tick nhiều cùng lúc).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Mã HS</th>
                    <th className="px-3 py-2.5 text-left">Họ và tên</th>
                    <th className="px-3 py-2.5 text-left">Phụ huynh</th>
                    <th className="px-3 py-2.5 text-left">SĐT phụ huynh</th>
                    <th className="px-3 py-2.5 text-right">Học phí</th>
                    <th className="px-3 py-2.5 text-left">Ngày vào</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600">
                        {s.student_code}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{s.display_name}</td>
                      <td className="px-3 py-2.5 text-slate-700">{s.parent_name ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">
                        {s.parent_phone ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {s.tuition_amount_vnd ? formatVnd(s.tuition_amount_vnd) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDate(s.enrolled_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setTransferOf(s)}
                            title="Chuyển lớp"
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setWithdrawOf(s)}
                            title="Cho nghỉ"
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "teachers" && (
        <TeachersTab classId={classId} className={className} />
      )}

      {tab === "sessions" && (
        <SessionsTab classId={classId} className={className} students={students} />
      )}

      {tab === "attendance" && (
        <AttendanceTab classId={classId} className={className} students={students} />
      )}

      {transferOf && (
        <TransferModal
          student={transferOf}
          onClose={() => setTransferOf(null)}
          onDone={() => {
            setTransferOf(null);
            setReload((k) => k + 1);
          }}
        />
      )}
      {withdrawOf && (
        <WithdrawModal
          student={withdrawOf}
          onClose={() => setWithdrawOf(null)}
          onDone={() => {
            setWithdrawOf(null);
            setReload((k) => k + 1);
          }}
        />
      )}
      {addingStudents && (
        <AddStudentsModal
          classId={classId}
          className={className}
          existingStudentIds={existingStudentIds}
          onClose={() => setAddingStudents(false)}
          onDone={(added) => {
            setAddingStudents(false);
            setReload((k) => k + 1);
            if (added > 0) toast.success(`Đã thêm ${added} học sinh vào lớp.`);
          }}
        />
      )}
      {bulkPaymentsOpen && (
        <BulkPaymentsModal
          classId={classId}
          className={className}
          onClose={() => setBulkPaymentsOpen(false)}
          onDone={(created) => {
            setBulkPaymentsOpen(false);
            toast.success(
              created > 0
                ? `Đã tạo ${created} khoản thu hàng tháng.`
                : "Không có khoản nào mới (đều đã tồn tại).",
            );
          }}
        />
      )}
    </div>
  );
}

function AttendanceTab({
  classId,
  className,
  students,
}: {
  classId: string;
  className: string;
  students: StudentInClass[];
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [stats, setStats] = useState<MonthlyAttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    monthlyAttendanceReport({ month, classId }).then((r) => {
      if (cancelled) return;
      if (r.success) setStats(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [month, classId]);

  const byStudent = useMemo(() => {
    const m = new Map<string, MonthlyAttendanceStat>();
    for (const s of stats) m.set(s.student_id, s);
    return m;
  }, [stats]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tháng
        </label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-400"
        />
        <p className="ml-auto text-xs text-slate-500">
          Lớp <strong>{className}</strong>
        </p>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : students.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center text-sm text-slate-500">
          Lớp chưa có học sinh.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Mã HS</th>
                <th className="px-3 py-2.5 text-left">Họ và tên</th>
                <th className="px-3 py-2.5 text-right">Có mặt</th>
                <th className="px-3 py-2.5 text-right">Vắng</th>
                <th className="px-3 py-2.5 text-right">Muộn</th>
                <th className="px-3 py-2.5 text-right">Có phép</th>
                <th className="px-3 py-2.5 text-right">Tổng buổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const stat = byStudent.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600">
                      {s.student_code}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{s.display_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">
                      {stat?.present_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">
                      {stat?.absent_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-700">
                      {stat?.late_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {stat?.excused_count ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                      {stat?.total_count ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransferModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentInClass;
  onClose: () => void;
  onDone: () => void;
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [newClass, setNewClass] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [carry, setCarry] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listClasses().then((r) => {
      if (r.success) setClasses((r.data as ClassRow[]).filter((c) => c.id !== student.id));
    });
  }, [student.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newClass) {
      setError("Chọn lớp mới.");
      return;
    }
    startTransition(async () => {
      const r = await transferStudent({
        current_enrollment_id: student.enrollment_id,
        new_class_id: newClass,
        effective_date: date,
        carry_over_tuition: carry,
        note: note.trim() || null,
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Chuyển lớp</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-mono">{student.student_code}</span> · {student.display_name}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Lớp mới *</Label>
            <select
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">— Chọn lớp mới —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.year_label ? ` (${c.year_label})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Ngày chuyển *</Label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={carry}
              onChange={(e) => setCarry(e.target.checked)}
              className="h-4 w-4"
            />
            Giữ nguyên học phí + chu kỳ đóng từ lớp cũ
          </label>
          <div className="space-y-1">
            <Label>Lý do</Label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
              placeholder="vd. Đổi lịch buổi tối sang sáng"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang chuyển…" : "Chuyển lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WithdrawModal({
  student,
  onClose,
  onDone,
}: {
  student: StudentInClass;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await withdrawEnrollment({
        enrollment_id: student.enrollment_id,
        effective_date: date,
        reason: reason.trim() || undefined,
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Cho học sinh nghỉ</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-mono">{student.student_code}</span> · {student.display_name}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Ngày nghỉ *</Label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <Label>Lý do</Label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang xử lý…" : "Cho nghỉ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// ══ Sessions Tab — tạo buổi + điểm danh ════════════════════════════════
function SessionsTab({
  classId,
  className,
  students,
}: {
  classId: string;
  className: string;
  students: StudentInClass[];
}) {
  const [sessions, setSessions] = useState<ClassSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<ClassSessionRow | null>(null);
  const [reload, setReload] = useState(0);
  const [pending, startTransition] = useTransition();
  // Multi-select cho thao tác hàng loạt — Set ID buổi đã tick.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled" | "upcoming" | "past">("active");
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  const filteredSessions = useMemo(() => {
    const now = Date.now();
    let xs = sessions;
    if (statusFilter === "active") xs = xs.filter((s) => !s.is_cancelled);
    else if (statusFilter === "cancelled") xs = xs.filter((s) => s.is_cancelled);
    else if (statusFilter === "upcoming")
      xs = xs.filter((s) => !s.is_cancelled && new Date(s.start_time).getTime() >= now);
    else if (statusFilter === "past")
      xs = xs.filter((s) => new Date(s.start_time).getTime() < now);
    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter((s) => s.title.toLowerCase().includes(q));
    }
    return xs;
  }, [sessions, statusFilter, search]);

  const {
    page,
    pageSize,
    paged,
    total: filteredTotal,
    setPage,
    setPageSize,
  } = usePagination(filteredSessions, 20);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSessionsForClass({ class_id: classId }).then((r) => {
      if (cancelled) return;
      if (r.success) setSessions(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, reload]);

  async function handleDelete(s: ClassSessionRow) {
    const ok = await confirm({
      title: "Xoá buổi học?",
      description: `${s.title} — ${formatDateTime(s.start_time)}. Hành động không thể hoàn tác.`,
      variant: "danger",
      confirmLabel: "Xoá",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteClassSession(s.id);
      if (r.success) {
        setSelected((p) => {
          const n = new Set(p);
          n.delete(s.id);
          return n;
        });
        toast.success(`Đã xoá ${s.title}.`);
        setReload((k) => k + 1);
      } else toast.error(r.error);
    });
  }

  function toggleSel(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    // Toggle all FILTERED (cross-page) — UX nhất quán với StudentsClient.
    setSelected((p) => {
      if (filteredSessions.every((s) => p.has(s.id))) {
        const n = new Set(p);
        filteredSessions.forEach((s) => n.delete(s.id));
        return n;
      }
      const n = new Set(p);
      filteredSessions.forEach((s) => n.add(s.id));
      return n;
    });
  }

  async function handleBulkDelete() {
    const count = selected.size;
    if (count === 0) return;
    const ok = await confirm({
      title: `Xoá ${count} buổi học?`,
      description: `${count} buổi đã chọn sẽ bị xoá. Hành động không thể hoàn tác.`,
      variant: "danger",
      confirmLabel: `Xoá ${count} buổi`,
    });
    if (!ok) return;
    startTransition(async () => {
      const ids = [...selected];
      let okCount = 0;
      let errors = 0;
      for (const id of ids) {
        const r = await deleteClassSession(id);
        if (r.success) okCount++;
        else errors++;
      }
      setSelected(new Set());
      setReload((k) => k + 1);
      if (errors === 0) toast.success(`Đã xoá ${okCount} buổi.`);
      else toast.error(`Xoá ${okCount}/${count} buổi. ${errors} buổi lỗi.`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Tạo buổi học cho lớp <strong>{className}</strong>, sau đó điểm danh
          từng buổi.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setBulkCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Tạo hàng loạt
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Tạo 1 buổi
          </button>
        </div>
      </div>

      {/* Filter row */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tiêu đề buổi…"
            className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-400"
          />
          <span className="font-semibold text-slate-500">Trạng thái:</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
            {(
              [
                ["active", "Còn"],
                ["upcoming", "Sắp tới"],
                ["past", "Đã qua"],
                ["cancelled", "Đã huỷ"],
                ["all", "Tất cả"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  statusFilter === v
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(statusFilter !== "active" || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("active");
                setSearch("");
              }}
              className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center text-sm text-slate-500">
          Chưa có buổi học nào. Bấm <strong>Tạo buổi học</strong> để bắt đầu.
        </p>
      ) : filteredSessions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center text-sm text-slate-500">
          Không có buổi nào khớp bộ lọc.
        </p>
      ) : (
        <>
          {/* Bulk action bar — chỉ hiện khi có item được chọn */}
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-indigo-900">
                Đã chọn <span className="font-mono">{selected.size}</span> /{" "}
                {filteredSessions.length} buổi
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  <Pencil className="h-3 w-3" />
                  Sửa hàng loạt
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Xoá {selected.size} buổi
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredSessions.length > 0 &&
                        filteredSessions.every((s) => selected.has(s.id))
                      }
                      ref={(el) => {
                        if (!el) return;
                        const some = filteredSessions.some((s) => selected.has(s.id));
                        const all = filteredSessions.every((s) => selected.has(s.id));
                        el.indeterminate = some && !all;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">Tiêu đề</th>
                  <th className="px-3 py-2.5 text-left">Thời gian</th>
                  <th className="px-3 py-2.5 text-left">GV phụ trách</th>
                  <th className="px-3 py-2.5 text-right">Thời lượng</th>
                  <th className="px-3 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((s) => {
                  const isSel = selected.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`${s.is_cancelled ? "opacity-50" : ""} ${isSel ? "bg-indigo-50/40" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSel(s.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {s.title}
                        {s.is_cancelled && (
                          <span className="ml-2 rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700">
                            đã huỷ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">
                        {formatDateTime(s.start_time)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {s.teacher_name ? (
                          <span>{s.teacher_name}</span>
                        ) : (
                          <span className="text-xs italic text-amber-700">
                            Chưa gán GV
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {s.duration_minutes} phút
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setAttendanceFor(s)}
                            disabled={s.is_cancelled || students.length === 0}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ClipboardCheck className="h-3 w-3" />
                            Điểm danh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            disabled={pending}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredTotal}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            unit="buổi"
          />
        </>
      )}

      {creating && (
        <CreateSessionModal
          classId={classId}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            setReload((k) => k + 1);
          }}
        />
      )}
      {bulkCreating && (
        <BulkSessionsModal
          classId={classId}
          className={className}
          onClose={() => setBulkCreating(false)}
          onDone={(created) => {
            setBulkCreating(false);
            setReload((k) => k + 1);
            toast.success(`Đã tạo ${created} buổi học.`);
          }}
        />
      )}
      {bulkEditOpen && (
        <BulkEditSessionsModal
          sessionIds={[...selected]}
          onClose={() => setBulkEditOpen(false)}
          onDone={() => {
            setBulkEditOpen(false);
            setSelected(new Set());
            setReload((k) => k + 1);
          }}
        />
      )}
      {attendanceFor && (
        <AttendanceMarkModal
          session={attendanceFor}
          students={students}
          onClose={() => setAttendanceFor(null)}
          onDone={() => {
            setAttendanceFor(null);
            setReload((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function CreateSessionModal({
  classId,
  onClose,
  onDone,
}: {
  classId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  defaultStart.setMinutes(0, 0, 0);
  const defaultStartStr = `${defaultStart.getFullYear()}-${pad(defaultStart.getMonth() + 1)}-${pad(defaultStart.getDate())}T${pad(defaultStart.getHours())}:${pad(defaultStart.getMinutes())}`;

  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartStr);
  const [duration, setDuration] = useState("90");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Default title = "Buổi N+1" với N = số buổi đang có. Tránh user
  // phải đếm thủ công + ngừng trùng tên với buổi trước.
  useEffect(() => {
    let cancelled = false;
    getClassSessionCount(classId).then((r) => {
      if (cancelled) return;
      if (r.success) setTitle(`Buổi ${r.data + 1}`);
      else setTitle("Buổi 1");
    });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createClassSession({
        class_id: classId,
        title: title.trim(),
        start_time: new Date(startTime).toISOString(),
        duration_minutes: Number(duration) || 90,
        description: description.trim(),
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Tạo buổi học</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Tiêu đề *</Label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="vd. Buổi 5 — Phương trình bậc 2"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Bắt đầu *</Label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <Label>Thời lượng (phút)</Label>
              <input
                type="number"
                min={15}
                max={720}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Mô tả</Label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang tạo…" : "Tạo buổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttendanceMarkModal({
  session,
  students,
  onClose,
  onDone,
}: {
  session: ClassSessionRow;
  students: StudentInClass[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Map<string, AttendanceStatus>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listAttendanceForSession(session.id).then((r) => {
      if (cancelled) return;
      if (r.success) {
        const m = new Map<string, AttendanceStatus>();
        const n = new Map<string, string>();
        for (const a of r.data) {
          m.set(a.student_id, a.status as AttendanceStatus);
          if (a.note) n.set(a.student_id, a.note);
        }
        // Default: HS chưa có record → PRESENT (mặc định có mặt)
        for (const s of students) {
          if (!m.has(s.id)) m.set(s.id, "PRESENT");
        }
        setRows(m);
        setNotes(n);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.id, students]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    const m = new Map(rows);
    m.set(studentId, status);
    setRows(m);
  }

  function handleSubmit() {
    setError(null);
    const payload = students
      .map((s) => {
        const status = rows.get(s.id);
        if (!status) return null;
        return {
          student_id: s.id,
          enrollment_id: s.enrollment_id,
          status,
          note: notes.get(s.id) || null,
        };
      })
      .filter(Boolean) as Array<{
        student_id: string;
        enrollment_id: string;
        status: AttendanceStatus;
        note: string | null;
      }>;

    startTransition(async () => {
      const r = await markAttendance({
        session_id: session.id,
        rows: payload,
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  // Thống kê tại chỗ
  const counts = useMemo(() => {
    let p = 0, a = 0, l = 0, e = 0;
    for (const status of rows.values()) {
      if (status === "PRESENT") p++;
      else if (status === "ABSENT") a++;
      else if (status === "LATE") l++;
      else if (status === "EXCUSED") e++;
    }
    return { p, a, l, e };
  }, [rows]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Điểm danh</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {session.title} · {formatDateTime(session.start_time)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
            Có mặt {counts.p}
          </span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
            Vắng {counts.a}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
            Muộn {counts.l}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
            Có phép {counts.e}
          </span>
        </div>

        <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
              <tr>
                <th className="px-3 py-2 text-left">HS</th>
                <th className="px-3 py-2 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const status = rows.get(s.id) ?? "PRESENT";
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{s.display_name}</div>
                      <div className="font-mono text-[10px] tabular-nums text-slate-500">
                        {s.student_code}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <Pill
                          active={status === "PRESENT"}
                          tone="emerald"
                          onClick={() => setStatus(s.id, "PRESENT")}
                        >
                          Có
                        </Pill>
                        <Pill
                          active={status === "LATE"}
                          tone="amber"
                          onClick={() => setStatus(s.id, "LATE")}
                        >
                          Muộn
                        </Pill>
                        <Pill
                          active={status === "EXCUSED"}
                          tone="slate"
                          onClick={() => setStatus(s.id, "EXCUSED")}
                        >
                          Phép
                        </Pill>
                        <Pill
                          active={status === "ABSENT"}
                          tone="rose"
                          onClick={() => setStatus(s.id, "ABSENT")}
                        >
                          Vắng
                        </Pill>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Đang lưu…" : "Lưu điểm danh"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "emerald" | "amber" | "slate" | "rose";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls: Record<string, { on: string; off: string }> = {
    emerald: {
      on: "bg-emerald-600 text-white",
      off: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    },
    amber: {
      on: "bg-amber-600 text-white",
      off: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    },
    slate: {
      on: "bg-slate-700 text-white",
      off: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    rose: {
      on: "bg-rose-600 text-white",
      off: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
        active ? cls[tone].on : cls[tone].off
      }`}
    >
      {children}
    </button>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
