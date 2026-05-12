"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { TenantTeacherRow } from "@/types/database";
import {
  createTenantTeacher,
  deleteTenantTeacher,
  updateTenantTeacher,
} from "@/app/actions/tenant-teachers";

interface TeachersAdminPanelProps {
  teachers: TenantTeacherRow[];
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
  color: string;
  is_admin: boolean;
}

const EMPTY_FORM: FormState = {
  display_name: "",
  email: "",
  color: "#6366F1",
  is_admin: false,
};

export default function TeachersAdminPanel({
  teachers,
  currentTeacherId,
}: TeachersAdminPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  }

  function openEdit(t: TenantTeacherRow) {
    setEditingId(t.id);
    setForm({
      display_name: t.display_name,
      email: t.email ?? "",
      color: t.color,
      is_admin: t.is_admin,
    });
    setIsOpen(true);
  }

  function handleSave() {
    if (!form.display_name.trim()) {
      toast.error("Vui lòng nhập tên giáo viên.");
      return;
    }
    startSavingTransition(async () => {
      const payload = {
        display_name: form.display_name.trim(),
        email: form.email.trim() || null,
        color: form.color,
        is_admin: form.is_admin,
      };
      const result = editingId
        ? await updateTenantTeacher(editingId, payload)
        : await createTenantTeacher(payload);
      if (result.success) {
        toast.success(editingId ? "Đã cập nhật giáo viên." : "Đã thêm giáo viên.");
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Lưu thất bại.");
      }
    });
  }

  function handleDelete(t: TenantTeacherRow) {
    if (!confirm(`Xóa giáo viên "${t.display_name}"? Các buổi học của họ sẽ giữ lại nhưng không còn được gán cho ai.`)) {
      return;
    }
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
          Trung tâm hiện có{" "}
          <span className="font-mono tabular-nums text-slate-700">
            {teachers.length}
          </span>{" "}
          giáo viên.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm giáo viên
        </button>
      </div>

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
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {teachers.map((t) => {
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
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Chỉnh sửa giáo viên" : "Thêm giáo viên"}
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

              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1.5 text-xs font-medium text-slate-600">
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
                <div>
                  <label className="mb-1.5 text-xs font-medium text-slate-600">
                    Email (tùy chọn)
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
                  <p className="mt-1 text-[11px] text-slate-400">
                    Email giúp ghép nối khi giáo viên đăng nhập trong tương lai.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-medium text-slate-600">
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
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
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
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
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
                    "Thêm giáo viên"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
