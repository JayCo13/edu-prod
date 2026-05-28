"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import type {
  TeacherPaymentStructure,
  TeacherRoleRow,
  TenantTeacherRow,
} from "@/types/database";
import {
  createTenantTeacher,
  createTeacherRole,
  deleteTenantTeacher,
  deleteTeacherRole,
  getCurrentTenantContextForClient,
  seedStandardTeacherRoles,
  updateTeacherRole,
  updateTenantTeacher,
} from "@/app/actions/tenant-teachers";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination, usePagination } from "@/components/ui/pagination";

interface TeachersAdminPanelProps {
  teachers: TenantTeacherRow[];
  roles: TeacherRoleRow[];
  currentTeacherId: string | null;
}

const PRESET_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#E11D48",
  "#A855F7",
  "#14B8A6",
  "#F97316",
];

interface FormState {
  display_name: string;
  email: string;
  password: string;
  color: string;
  is_admin: boolean;
  /** Tenant-scoped position (Hiệu trưởng, Giáo viên, ...) — migration 0032. */
  role_id: string | null;
  // Payment — calculator feeds off these (migration 0022).
  payment_structure: TeacherPaymentStructure;
  hourly_rate: number;
  per_session_rate: number;
  fixed_monthly_amount: number;
  tax_id: string;
}

const EMPTY_FORM: FormState = {
  display_name: "",
  email: "",
  password: "",
  color: "#6366F1",
  is_admin: false,
  role_id: null,
  payment_structure: "HOURLY",
  hourly_rate: 0,
  per_session_rate: 0,
  fixed_monthly_amount: 0,
  tax_id: "",
};

// Map field-relevance to payment structure so we hide irrelevant inputs and
// don't accidentally send stale rates when the admin switches structure.
const STRUCTURE_FIELDS: Record<
  TeacherPaymentStructure,
  { hourly: boolean; perSession: boolean; fixedMonthly: boolean }
> = {
  HOURLY: { hourly: true, perSession: false, fixedMonthly: false },
  PER_SESSION: { hourly: false, perSession: true, fixedMonthly: false },
  FIXED_MONTHLY: { hourly: false, perSession: false, fixedMonthly: true },
  HYBRID: { hourly: true, perSession: true, fixedMonthly: true },
};

const STRUCTURE_LABEL: Record<TeacherPaymentStructure, string> = {
  HOURLY: "Theo giờ",
  PER_SESSION: "Theo buổi",
  FIXED_MONTHLY: "Lương cố định / tháng",
  HYBRID: "Kết hợp",
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

/** Strip Vietnamese diacritics so "nguyen" matches "Nguyễn" (CLAUDE.md §8.3). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "admin" | "teacher";

export default function TeachersAdminPanel({
  teachers,
  roles: initialRoles,
  currentTeacherId,
}: TeachersAdminPanelProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Sidebar's "Tạo giáo viên" quick-action navigates with ?create=1 —
  // start opened on first mount when that param is present.
  const [isOpen, setIsOpen] = useState(
    () => searchParams.get("create") === "1",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Product face — controls how this form behaves:
  //   CENTER → full flow (email + password required, sends invite email,
  //            payroll fields visible).
  //   SCHOOL → lite flow (just name + color; no auth account, no email
  //            send, no payroll fields — teachers are labels for the TKB).
  const [kind, setKind] = useState<"CENTER" | "SCHOOL">("CENTER");
  useEffect(() => {
    getCurrentTenantContextForClient().then((r) => {
      if (r.success && r.data) setKind(r.data.kind);
    });
  }, []);
  const isSchool = kind === "SCHOOL";

  // Tenant roles — kept in client state so the roles-management modal can
  // add/edit/delete without a full router refresh on each action.
  const [roles, setRoles] = useState<TeacherRoleRow[]>(initialRoles);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const rolesById = useMemo(
    () => new Map(roles.map((r) => [r.id, r])),
    [roles],
  );

  // ── Filters ──────────────────────────────────────────────────────────────
  // Diacritic-insensitive search on name + email, plus status + role pills.
  // Filter UI sits above the list; the displayed array is always derived
  // from `teachers` via useMemo so prop updates (router.refresh) reflect.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filteredTeachers = useMemo(() => {
    const q = normalize(query.trim());
    return teachers.filter((t) => {
      if (statusFilter === "active" && !t.is_active) return false;
      if (statusFilter === "inactive" && t.is_active) return false;
      if (roleFilter === "admin" && !t.is_admin) return false;
      if (roleFilter === "teacher" && t.is_admin) return false;
      if (q) {
        const hay = `${normalize(t.display_name)} ${normalize(t.email ?? "")}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teachers, query, statusFilter, roleFilter]);

  const hasActiveFilter =
    query.trim() !== "" || statusFilter !== "all" || roleFilter !== "all";

  // Paginate the filtered results. usePagination handles the slice + clamps
  // page when the filtered set shrinks.
  const pager = usePagination(filteredTeachers, 20);

  // Strip ?create=1 after first mount so a refresh / back doesn't reopen.
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("create");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setIsOpen(true);
  }

  function openEdit(t: TenantTeacherRow) {
    setEditingId(t.id);
    setForm({
      display_name: t.display_name,
      email: t.email ?? "",
      password: "",
      color: t.color,
      is_admin: t.is_admin,
      role_id: t.role_id ?? null,
      payment_structure: t.payment_structure,
      hourly_rate: t.hourly_rate ?? 0,
      per_session_rate: t.per_session_rate ?? 0,
      fixed_monthly_amount: t.fixed_monthly_amount ?? 0,
      tax_id: t.tax_id ?? "",
    });
    setShowPassword(false);
    setIsOpen(true);
  }

  function handleSave() {
    if (!form.display_name.trim()) {
      toast.error("Vui lòng nhập tên giáo viên.");
      return;
    }
    // SCHOOL = lite mode: only display_name is required. CENTER keeps the
    // full credentials flow when creating a new teacher.
    if (!editingId && !isSchool) {
      if (!form.email.trim()) {
        toast.error("Vui lòng nhập email giáo viên.");
        return;
      }
      if (form.password.length < 6) {
        toast.error("Mật khẩu phải có ít nhất 6 ký tự.");
        return;
      }
    }
    // Strip rate fields that aren't relevant to the chosen structure so we
    // don't shadow values the admin already cleared (e.g. switch HYBRID →
    // HOURLY should zero out per_session_rate and fixed_monthly_amount).
    // SCHOOL has no payroll → ship zeros, server keeps the defaults.
    const fields = STRUCTURE_FIELDS[form.payment_structure];
    const ratePayload = isSchool
      ? {
          payment_structure: "HOURLY" as const,
          hourly_rate: 0,
          per_session_rate: null,
          fixed_monthly_amount: null,
          tax_id: null,
        }
      : {
          payment_structure: form.payment_structure,
          hourly_rate: fields.hourly ? form.hourly_rate : 0,
          per_session_rate: fields.perSession ? form.per_session_rate : null,
          fixed_monthly_amount: fields.fixedMonthly
            ? form.fixed_monthly_amount
            : null,
          tax_id: form.tax_id.trim() || null,
        };

    startSavingTransition(async () => {
      const result = editingId
        ? await updateTenantTeacher(editingId, {
            display_name: form.display_name.trim(),
            email: form.email.trim() || null,
            color: form.color,
            is_admin: form.is_admin,
            role_id: form.role_id,
            ...ratePayload,
          })
        : await createTenantTeacher({
            display_name: form.display_name.trim(),
            // SCHOOL passes the email through (may be empty) so it's saved
            // as contact info, but password stays "" — the action's lite
            // mode triggers on "no password", which skips auth + invite.
            email: form.email.trim(),
            password: isSchool ? "" : form.password,
            color: form.color,
            is_admin: form.is_admin,
            role_id: form.role_id,
            ...ratePayload,
          });
      if (result.success) {
        toast.success(
          editingId
            ? "Đã cập nhật giáo viên."
            : isSchool
              ? "Đã thêm giáo viên."
              : "Đã tạo tài khoản giáo viên và gửi email cho giáo viên.",
        );
        if (result.warning) {
          toast.warning(result.warning);
        }
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Lưu thất bại.");
      }
    });
  }

  async function handleDelete(t: TenantTeacherRow) {
    const ok = await confirm({
      title: `Xoá giáo viên "${t.display_name}"?`,
      variant: "danger",
      confirmLabel: "Xoá giáo viên",
      description:
        "Các buổi học của giáo viên này sẽ giữ lại nhưng không còn được gán cho ai. Hành động này không thể hoàn tác.",
    });
    if (!ok) return;
    setPendingDeleteId(t.id);
    startDeletingTransition(async () => {
      const result = await deleteTenantTeacher(t.id);
      setPendingDeleteId(null);
      if (result.success) {
        toast.success("Đã xóa giáo viên.");
        router.refresh();
      } else {
        toast.error(result.error || "Xóa thất bại.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {isSchool ? "Trường" : "Trung tâm"} hiện có{" "}
          <span className="font-mono tabular-nums text-slate-700">
            {teachers.length}
          </span>{" "}
          giáo viên
          {hasActiveFilter && (
            <>
              {" "}· hiển thị{" "}
              <span className="font-mono tabular-nums text-slate-700">
                {filteredTeachers.length}
              </span>
            </>
          )}
          .
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRolesModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            title="Quản lý vai trò / chức vụ"
          >
            <Briefcase className="h-4 w-4" />
            Vai trò
            {roles.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 font-mono text-[10px] tabular-nums text-slate-500">
                {roles.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openCreate}
            data-tour="teachers.add"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Thêm giáo viên
          </button>
        </div>
      </div>

      {/* Filters — diacritic-insensitive search + status + role pills.
          Hidden when there's nothing to filter (no teachers yet). */}
      {teachers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc email…"
              className="w-full rounded-lg border border-transparent bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Xoá tìm kiếm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FilterPills
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "active", label: "Đang hoạt động" },
              { value: "inactive", label: "Tạm ngưng" },
            ]}
          />

          {!isSchool && (
            <FilterPills
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "Mọi vai trò" },
                { value: "admin", label: "Quản trị" },
                { value: "teacher", label: "Giáo viên" },
              ]}
            />
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setRoleFilter("all");
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
              Xoá bộ lọc
            </button>
          )}
        </div>
      )}

      {/* List */}
      {teachers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
            <User className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            Chưa có giáo viên nào trong trung tâm.
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Thêm giáo viên đầu tiên để có thể xếp lịch dạy cho họ.
          </p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <div className="mb-3 rounded-full bg-slate-100 p-2.5 text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            Không có giáo viên khớp bộ lọc.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setRoleFilter("all");
            }}
            className="mt-3 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Xoá bộ lọc
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {pager.paged.map((t) => {
            const isMe = t.id === currentTeacherId;
            const isPendingDelete =
              isDeleting && pendingDeleteId === t.id;
            return (
              <li
                key={t.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/50"
              >
                <span
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-mono text-sm font-bold text-white shadow-sm"
                  style={{ background: t.color }}
                  title={t.color}
                >
                  {t.display_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t.display_name}
                    </p>
                    {t.role_id && rolesById.has(t.role_id) && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          background: `${rolesById.get(t.role_id)!.color}1A`,
                          color: rolesById.get(t.role_id)!.color,
                        }}
                      >
                        <Briefcase className="h-2.5 w-2.5" />
                        {rolesById.get(t.role_id)!.name}
                      </span>
                    )}
                    {t.is_admin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Quản trị
                      </span>
                    )}
                    {isMe && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Bạn
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Tạm ngưng
                      </span>
                    )}
                    {!t.profile_id && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Chưa liên kết tài khoản
                      </span>
                    )}
                  </div>
                  {t.email && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="h-3 w-3" />
                      {t.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Chỉnh sửa"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={isPendingDelete}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Xóa"
                  >
                    {isPendingDelete ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination — only rendered when there are filtered results.
          Hides itself automatically if everything fits on one page. */}
      {filteredTeachers.length > 0 && (
        <Pagination
          page={pager.page}
          pageSize={pager.pageSize}
          total={pager.total}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          unit="giáo viên"
        />
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !isSaving && setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
                isSchool ? "max-w-lg" : "max-w-3xl"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? "Chỉnh sửa giáo viên"
                    : "Tạo tài khoản giáo viên"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Two-column body: identity on the left, payroll on the right.
                  Stacks to one column on small screens. The body is scrollable
                  so the modal never exceeds 90vh even on short windows. */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div
                  className={`grid grid-cols-1 gap-x-6 gap-y-5 ${
                    isSchool ? "" : "sm:grid-cols-2"
                  }`}
                >
                  {/* ── LEFT: Thông tin cơ bản ─────────────────────────── */}
                  <section className="space-y-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Thông tin cơ bản
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tên, đăng nhập, và nhận diện trên lịch.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Tên hiển thị *
                      </label>
                      <input
                        type="text"
                        value={form.display_name}
                        onChange={(e) =>
                          setForm({ ...form, display_name: e.target.value })
                        }
                        placeholder="Cô Hà"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    {/* Email — required for CENTER (drives the auth/invite
                        flow); optional for SCHOOL (kept purely as a contact
                        record, no account is created). */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Mail className="h-3.5 w-3.5" />
                        Email{" "}
                        {isSchool || editingId ? "(tùy chọn)" : "*"}
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        placeholder="ha@truongabc.edu.vn"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      {!editingId && !isSchool && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Giáo viên sẽ dùng email này để đăng nhập.
                        </p>
                      )}
                      {isSchool && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Chỉ để lưu liên hệ — không gửi email, không tạo
                          tài khoản đăng nhập.
                        </p>
                      )}
                    </div>

                    {/* Password — CENTER-only since SCHOOL never creates
                        auth accounts. */}
                    {!isSchool && !editingId && (
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <KeyRound className="h-3.5 w-3.5" />
                          Mật khẩu *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) =>
                              setForm({ ...form, password: e.target.value })
                            }
                            placeholder="Tối thiểu 6 ký tự"
                            autoComplete="new-password"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            tabIndex={-1}
                            aria-label={
                              showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Bạn cần chia sẻ mật khẩu này với giáo viên. Họ có thể
                          đổi sau khi đăng nhập lần đầu.
                        </p>
                      </div>
                    )}

                    {/* Role / position (migration 0032). Tenant-scoped list
                        managed via the "Quản lý vai trò" modal in the toolbar. */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Briefcase className="h-3.5 w-3.5" />
                        Vai trò / chức vụ
                      </label>
                      <select
                        value={form.role_id ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, role_id: e.target.value || null })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">— Chưa gán —</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {roles.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setRolesModalOpen(true)}
                          className="mt-1 text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        >
                          + Tạo vai trò đầu tiên
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Màu nhận diện
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm({ ...form, color: c })}
                            className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                              form.color.toUpperCase() === c.toUpperCase()
                                ? "border-slate-900 shadow-sm"
                                : "border-transparent"
                            }`}
                            style={{ background: c }}
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={form.color}
                          onChange={(e) =>
                            setForm({ ...form, color: e.target.value })
                          }
                          className="h-7 w-7 cursor-pointer rounded-lg border border-slate-200"
                          title="Màu khác"
                        />
                      </div>
                    </div>

                    {/* Admin checkbox: SCHOOL teachers don't have auth
                        accounts (lite mode) so "admin" is meaningless —
                        hide for SCHOOL. */}
                    {!isSchool && (
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={form.is_admin}
                          onChange={(e) =>
                            setForm({ ...form, is_admin: e.target.checked })
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                        <div className="flex-1 text-xs">
                          <span className="font-semibold text-slate-700">
                            Quản trị viên trung tâm
                          </span>
                          <p className="mt-0.5 text-slate-500">
                            Có thể quản lý lịch của tất cả giáo viên và thêm/xóa
                            giáo viên khác.
                          </p>
                        </div>
                      </label>
                    )}
                  </section>

                  {/* ── RIGHT: Lương & thuế ────────────────────────────
                      Calculator-facing config. Reveals only the rate inputs
                      relevant to the chosen payment structure.
                      Hidden entirely for SCHOOL (no payroll product face). */}
                  {!isSchool && (
                  <section className="space-y-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        Lương & thuế
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Dùng cho tính bảng lương cuối kỳ. Có thể chỉnh sau.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Hình thức trả lương
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            "HOURLY",
                            "PER_SESSION",
                            "FIXED_MONTHLY",
                            "HYBRID",
                          ] as const
                        ).map((s) => {
                          const isActive = form.payment_structure === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                setForm({ ...form, payment_structure: s })
                              }
                              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                isActive
                                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                              aria-pressed={isActive}
                            >
                              {STRUCTURE_LABEL[s]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {STRUCTURE_FIELDS[form.payment_structure].hourly && (
                      <RateField
                        label="Đơn giá / giờ"
                        suffix="đ"
                        value={form.hourly_rate}
                        onChange={(v) => setForm({ ...form, hourly_rate: v })}
                      />
                    )}
                    {STRUCTURE_FIELDS[form.payment_structure].perSession && (
                      <RateField
                        label="Đơn giá / buổi"
                        suffix="đ"
                        value={form.per_session_rate}
                        onChange={(v) =>
                          setForm({ ...form, per_session_rate: v })
                        }
                      />
                    )}
                    {STRUCTURE_FIELDS[form.payment_structure].fixedMonthly && (
                      <RateField
                        label="Lương cố định / tháng"
                        suffix="đ"
                        value={form.fixed_monthly_amount}
                        onChange={(v) =>
                          setForm({ ...form, fixed_monthly_amount: v })
                        }
                      />
                    )}

                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                        <span>Mã số thuế (MST)</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                          (tùy chọn)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={form.tax_id}
                        onChange={(e) =>
                          setForm({ ...form, tax_id: e.target.value })
                        }
                        placeholder="Ví dụ: 0123456789"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Sẽ hiển thị trên file Excel bảng lương.
                      </p>
                    </div>
                  </section>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingId ? (
                    "Lưu thay đổi"
                  ) : (
                    "Tạo tài khoản"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Roles management modal ────────────────────────────────────── */}
      <RolesManager
        open={rolesModalOpen}
        onClose={() => setRolesModalOpen(false)}
        roles={roles}
        setRoles={setRoles}
        kind={kind}
      />
    </div>
  );
}

// ── RolesManager ──────────────────────────────────────────────────────────
// Modal CRUD for `teacher_roles`. Add/rename/delete + 1-click seed of the
// standard VN list for the current product face (CENTER vs SCHOOL). Color
// + short_code editable inline. Deletes are confirmed-free here because
// removing a role only sets affected teachers' role_id to NULL (per the FK
// ON DELETE SET NULL rule, migration 0032).
function RolesManager({
  open,
  onClose,
  roles,
  setRoles,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  roles: TeacherRoleRow[];
  setRoles: React.Dispatch<React.SetStateAction<TeacherRoleRow[]>>;
  kind: "CENTER" | "SCHOOL";
}) {
  const [newName, setNewName] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [newColor, setNewColor] = useState("#64748B");
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inline edit state — only one row at a time.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortCode, setEditShortCode] = useState("");
  const [editColor, setEditColor] = useState("#64748B");

  function startEdit(r: TeacherRoleRow) {
    setEditId(r.id);
    setEditName(r.name);
    setEditShortCode(r.short_code);
    setEditColor(r.color);
  }
  function cancelEdit() {
    setEditId(null);
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Nhập tên vai trò.");
      return;
    }
    setAdding(true);
    const r = await createTeacherRole({
      name: trimmed,
      short_code: newShortCode.trim(),
      color: newColor,
      sort_order: 100 + roles.length,
    });
    setAdding(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    setRoles((prev) => [...prev, r.data!]);
    setNewName("");
    setNewShortCode("");
    setNewColor("#64748B");
    toast.success("Đã tạo vai trò.");
  }

  async function handleSeed() {
    setSeeding(true);
    const r = await seedStandardTeacherRoles();
    setSeeding(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const { created, skipped } = r.data!;
    if (created.length > 0) {
      setRoles((prev) =>
        [...prev, ...created].sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    if (created.length === 0) {
      toast.info("Tất cả vai trò mặc định đã tồn tại.");
    } else if (skipped.length === 0) {
      toast.success(`Đã tạo ${created.length} vai trò.`);
    } else {
      toast.success(
        `Đã tạo ${created.length} vai trò · bỏ qua ${skipped.length} đã có.`,
      );
    }
  }

  async function handleSaveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Tên vai trò không được trống.");
      return;
    }
    setBusyId(id);
    const r = await updateTeacherRole(id, {
      name: trimmed,
      short_code: editShortCode.trim(),
      color: editColor,
    });
    setBusyId(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    setRoles((prev) =>
      prev.map((x) => (x.id === id ? (r.data as TeacherRoleRow) : x)),
    );
    setEditId(null);
    toast.success("Đã lưu vai trò.");
  }

  async function handleDelete(r: TeacherRoleRow) {
    setBusyId(r.id);
    const result = await deleteTeacherRole(r.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setRoles((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(`Đã xoá vai trò "${r.name}".`);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Quản lý vai trò / chức vụ
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {kind === "SCHOOL"
                    ? "Hiệu trưởng, Phó hiệu trưởng, GVCN, GV bộ môn..."
                    : "Quản lý, Trưởng bộ môn, Giáo viên, Trợ giảng..."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {/* Seed banner — show only if there are very few roles. */}
              {roles.length <= 2 && (
                <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-900">
                      Tạo các vai trò chuẩn{" "}
                      {kind === "SCHOOL" ? "trường học" : "trung tâm"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-slate-600">
                      {kind === "SCHOOL"
                        ? "Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng, GVCN, GV bộ môn, Giáo vụ."
                        : "Quản lý, Trưởng bộ môn, Giáo viên, Trợ giảng, Cố vấn."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {seeding ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> ...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Tạo
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Add new role row */}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                  Thêm vai trò mới
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_auto_auto]">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tên · VD: Hiệu trưởng"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    type="text"
                    value={newShortCode}
                    onChange={(e) =>
                      setNewShortCode(e.target.value.toUpperCase().slice(0, 8))
                    }
                    placeholder="Mã · HT"
                    maxLength={8}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) =>
                      setNewColor(e.target.value.toUpperCase())
                    }
                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                    title="Màu"
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={adding}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {adding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Thêm
                  </button>
                </div>
              </div>

              {/* Existing roles list */}
              {roles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white py-8 text-center">
                  <Briefcase className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">
                    Chưa có vai trò nào.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Dùng nút &quot;Tạo&quot; ở trên để seed danh sách chuẩn.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {roles.map((r) => {
                    const isEditing = editId === r.id;
                    const isBusy = busyId === r.id;
                    if (isEditing) {
                      return (
                        <li
                          key={r.id}
                          className="grid grid-cols-1 gap-2 bg-indigo-50/30 px-3 py-2.5 sm:grid-cols-[1fr_90px_auto_auto_auto]"
                        >
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            type="text"
                            value={editShortCode}
                            onChange={(e) =>
                              setEditShortCode(
                                e.target.value.toUpperCase().slice(0, 8),
                              )
                            }
                            maxLength={8}
                            placeholder="Mã"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm uppercase text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) =>
                              setEditColor(e.target.value.toUpperCase())
                            }
                            className="h-8 w-10 cursor-pointer rounded-lg border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(r.id)}
                            disabled={isBusy}
                            className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Lưu"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
                          >
                            Huỷ
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <span
                          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold text-white"
                          style={{ background: r.color }}
                        >
                          {r.short_code ||
                            r.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {r.name}
                          </p>
                          <p className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                            {r.short_code || "—"} ·{" "}
                            <span style={{ color: r.color }}>{r.color}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          disabled={isBusy}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                          aria-label={`Chỉnh sửa ${r.name}`}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          disabled={isBusy}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          aria-label={`Xoá ${r.name}`}
                          title="Xoá"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-[11px] text-slate-400">
                <Settings2 className="mr-1 inline h-3 w-3" />
                Xoá vai trò sẽ huỷ gán khỏi giáo viên đang dùng (nhưng không
                xoá giáo viên).
              </p>
            </div>

            <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Xong
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** VND amount input with thousand-separator hint. Stores an integer; the
 *  user types digits, we render with dots, and parse on every keystroke. */
function RateField({
  label,
  value,
  onChange,
  suffix = "đ",
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
}) {
  // Local string so the user can clear the field without it jumping to "0".
  const [text, setText] = useState<string>(value > 0 ? formatVND(value) : "");

  useEffect(() => {
    // Sync from outside when the structure toggle changes which fields render.
    setText(value > 0 ? formatVND(value) : "");
  }, [value]);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            const n = digits ? parseInt(digits, 10) : 0;
            setText(digits ? formatVND(n) : "");
            onChange(n);
          }}
          placeholder="0"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 pr-9 text-sm font-mono tabular-nums text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}

// ── FilterPills ────────────────────────────────────────────────────────────
// Segmented control for the teachers list filters. Generic over the value
// type so both StatusFilter and RoleFilter can reuse it.
function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
