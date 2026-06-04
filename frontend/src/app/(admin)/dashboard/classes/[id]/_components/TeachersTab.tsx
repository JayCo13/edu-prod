"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Crown,
  GraduationCap,
  Plus,
  UserMinus,
  Users as UsersIcon,
  X,
} from "lucide-react";

import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  assignTeacherToClass,
  listClassTeachers,
  listTenantTeachers,
  removeTeacherFromClass,
  updateClassTeacherRole,
  type ClassTeacherRole,
  type ClassTeacherWithProfile,
  type SimpleTeacher,
} from "@/modules/classes/actions";

interface Props {
  classId: string;
  className: string;
}

export default function TeachersTab({ classId, className }: Props) {
  const [rows, setRows] = useState<ClassTeacherWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listClassTeachers(classId).then((r) => {
      if (cancelled) return;
      if (r.success) setRows(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, reload]);

  const primary = rows.find((r) => r.role === "PRIMARY");
  const assistants = rows.filter((r) => r.role === "ASSISTANT");

  async function handleRemove(row: ClassTeacherWithProfile) {
    const isPrimary = row.role === "PRIMARY";
    const ok = await confirm({
      title: `Gỡ ${isPrimary ? "GV chính" : "trợ giảng"}?`,
      description: isPrimary
        ? `Gỡ ${row.teacher.display_name} khỏi vai trò GV chính. Các buổi tương lai của lớp sẽ bị xoá GV (cần gán GV mới sau).`
        : `Gỡ ${row.teacher.display_name} khỏi danh sách trợ giảng của lớp. Các buổi đã ghi nhận vẫn giữ nguyên giáo viên phụ trách.`,
      variant: "warning",
      confirmLabel: "Gỡ",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await removeTeacherFromClass({
        class_teacher_id: row.id,
        also_clear_future_sessions: isPrimary,
      });
      if (r.success) {
        setReload((k) => k + 1);
        toast.success(
          r.data.sessions_cleared > 0
            ? `Đã gỡ. Bỏ giáo viên phụ trách khỏi ${r.data.sessions_cleared} buổi sắp tới.`
            : "Đã gỡ giáo viên khỏi lớp.",
        );
      } else toast.error(r.error);
    });
  }

  async function handlePromote(row: ClassTeacherWithProfile) {
    if (row.role === "PRIMARY") return;
    const ok = await confirm({
      title: "Chuyển thành GV chính?",
      description: primary
        ? `${row.teacher.display_name} sẽ trở thành GV chính. ${primary.teacher.display_name} sẽ chuyển sang vai trò trợ giảng. Các buổi sắp tới sẽ tự đổi sang GV mới.`
        : `${row.teacher.display_name} sẽ là GV chính của lớp. Các buổi sắp tới chưa có giáo viên sẽ tự nhận GV này.`,
      variant: "info",
      confirmLabel: "Chuyển",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await updateClassTeacherRole({
        class_teacher_id: row.id,
        new_role: "PRIMARY",
      });
      if (r.success) {
        setReload((k) => k + 1);
        toast.success(
          r.data.sessions_updated > 0
            ? `Đã chuyển. Cập nhật giáo viên cho ${r.data.sessions_updated} buổi sắp tới.`
            : "Đã chuyển thành GV chính.",
        );
      } else toast.error(r.error);
    });
  }

  async function handleDemote(row: ClassTeacherWithProfile) {
    if (row.role === "ASSISTANT") return;
    const ok = await confirm({
      title: "Hạ thành trợ giảng?",
      description:
        "Lớp sẽ không còn GV chính. Các buổi sắp tới do GV này phụ trách sẽ trở về trạng thái chưa có giáo viên — cần gán GV chính mới sau đó.",
      variant: "warning",
      confirmLabel: "Hạ",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await updateClassTeacherRole({
        class_teacher_id: row.id,
        new_role: "ASSISTANT",
      });
      if (r.success) {
        setReload((k) => k + 1);
        toast.success(
          r.data.sessions_updated > 0
            ? `Đã hạ. Bỏ giáo viên phụ trách khỏi ${r.data.sessions_updated} buổi sắp tới.`
            : "Đã hạ về trợ giảng.",
        );
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          GV chính của <strong>{className}</strong> được auto gán cho các buổi
          mới tạo. Trợ giảng vẫn thấy lịch lớp trong calendar.
        </p>
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Gán giáo viên
        </button>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Lớp chưa có giáo viên nào được gán.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Bấm <strong>Gán giáo viên</strong> để bắt đầu. GV chính được auto
            điền cho buổi mới tạo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* GV chính */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <Crown className="h-3.5 w-3.5" />
              Giáo viên chính
            </p>
            {primary ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {primary.teacher.display_name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Gán từ {formatVnDate(primary.assigned_at)}
                    {!primary.teacher.is_active && " · GV đã ngừng kích hoạt"}
                    {primary.teacher.profile_id == null && " · chưa có tài khoản đăng nhập"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleDemote(primary)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Hạ về trợ giảng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(primary)}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    title="Gỡ khỏi lớp"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-800">
                Chưa có GV chính. Bấm <strong>Gán giáo viên</strong> để gán.
              </p>
            )}
          </div>

          {/* Trợ giảng */}
          {assistants.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <UsersIcon className="h-3.5 w-3.5" />
                Trợ giảng ({assistants.length})
              </p>
              <ul className="mt-2 divide-y divide-slate-100">
                {assistants.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {a.teacher.display_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Gán từ {formatVnDate(a.assigned_at)}
                        {!a.teacher.is_active && " · GV đã ngừng kích hoạt"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => handlePromote(a)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Crown className="h-3 w-3" />
                        Đặt làm GV chính
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(a)}
                        disabled={pending}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                        title="Gỡ khỏi lớp"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {assignOpen && (
        <AssignTeacherDialog
          classId={classId}
          existingTeacherIds={new Set(rows.map((r) => r.teacher_id))}
          hasPrimary={!!primary}
          onClose={() => setAssignOpen(false)}
          onDone={(msg) => {
            setAssignOpen(false);
            setReload((k) => k + 1);
            toast.success(msg);
          }}
        />
      )}
    </div>
  );
}

function AssignTeacherDialog({
  classId,
  existingTeacherIds,
  hasPrimary,
  onClose,
  onDone,
}: {
  classId: string;
  existingTeacherIds: Set<string>;
  hasPrimary: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [allTeachers, setAllTeachers] = useState<SimpleTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [role, setRole] = useState<ClassTeacherRole>(hasPrimary ? "ASSISTANT" : "PRIMARY");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listTenantTeachers().then((r) => {
      if (r.success) setAllTeachers(r.data);
      setLoading(false);
    });
  }, []);

  const available = allTeachers.filter(
    (t) => !existingTeacherIds.has(t.id) && t.is_active,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!teacherId) {
      setError("Chọn giáo viên.");
      return;
    }
    startTransition(async () => {
      const r = await assignTeacherToClass({
        class_id: classId,
        teacher_id: teacherId,
        role,
        replace_existing_primary: replaceExisting,
      });
      if (r.success) {
        const teacherName = r.data.row.teacher.display_name;
        let msg = `Đã gán ${teacherName} làm ${
          role === "PRIMARY" ? "GV chính" : "trợ giảng"
        }.`;
        if (r.data.replaced_primary) {
          msg += ` ${r.data.replaced_primary.display_name} đã thành trợ giảng.`;
        }
        if (r.data.sessions_updated > 0) {
          msg += ` Cập nhật ${r.data.sessions_updated} buổi tương lai.`;
        }
        onDone(msg);
      } else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Gán giáo viên</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <Field label="Giáo viên" required>
              {loading ? (
                <p className="text-xs text-slate-500">Đang tải danh sách GV…</p>
              ) : available.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Không còn GV nào để gán. Tất cả GV đang hoạt động đã được gán
                  vào lớp này rồi.
                </p>
              ) : (
                <select
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Chọn GV —</option>
                  {available.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Vai trò" required>
              <div className="grid grid-cols-2 gap-2">
                <RoleCard
                  on={role === "PRIMARY"}
                  onSelect={() => setRole("PRIMARY")}
                  icon={<Crown className="h-3.5 w-3.5" />}
                  label="GV chính"
                  hint="Auto gán cho buổi mới"
                  tone="amber"
                />
                <RoleCard
                  on={role === "ASSISTANT"}
                  onSelect={() => setRole("ASSISTANT")}
                  icon={<UsersIcon className="h-3.5 w-3.5" />}
                  label="Trợ giảng"
                  hint="Vẫn thấy lịch trong calendar"
                  tone="slate"
                />
              </div>
            </Field>

            {role === "PRIMARY" && hasPrimary && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-sm text-slate-700 hover:bg-amber-50">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-600"
                />
                <span>
                  <strong>Thay GV chính hiện tại</strong>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Lớp đang có GV chính. Tick để hạ GV cũ thành trợ giảng và
                    đẩy GV mới lên — buổi tương lai tự cập nhật.
                  </p>
                </span>
              </label>
            )}

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-slate-100 bg-slate-50/40 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending || !teacherId || available.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang gán…" : "Gán"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleCard({
  on,
  onSelect,
  icon,
  label,
  hint,
  tone,
}: {
  on: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  tone: "amber" | "slate";
}) {
  const colors = {
    amber: on ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white",
    slate: on ? "border-slate-700 bg-slate-50" : "border-slate-200 bg-white",
  } as const;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${colors[tone]} hover:shadow-sm`}
    >
      <span
        className={`flex items-center gap-1 text-xs font-bold ${
          tone === "amber" ? "text-amber-800" : "text-slate-800"
        }`}
      >
        {icon}
        {label}
      </span>
      <span className="text-[10px] leading-snug text-slate-500">{hint}</span>
    </button>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
