"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Camera,
  Check,
  Hash,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";

import type { TeacherPayoutMethodRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  createMyPayoutMethod,
  deleteMyPayoutMethod,
  getQrSignedUrl,
  updateMyPayoutMethod,
} from "@/app/actions/payout-methods";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  initialMethods: TeacherPayoutMethodRow[];
}

interface FormState {
  bank_name: string;
  account_number: string;
  account_holder: string;
  qr_image_path: string | null;
}

const EMPTY_FORM: FormState = {
  bank_name: "",
  account_number: "",
  account_holder: "",
  qr_image_path: null,
};

const QR_BUCKET = "payout-qr";

function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

export default function PayoutMethodsPanel({ initialMethods }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [methods, setMethods] = useState<TeacherPayoutMethodRow[]>(initialMethods);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const hasAny = methods.length > 0;
  const hasPrimary = methods.some((m) => m.is_primary && m.is_active);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(m: TeacherPayoutMethodRow) {
    setEditingId(m.id);
    setForm({
      bank_name: m.bank_name,
      account_number: m.account_number,
      account_holder: m.account_holder,
      qr_image_path: m.qr_image_path,
    });
    setOpen(true);
  }

  async function handleUploadQr(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4 MB).");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Phiên đăng nhập đã hết hạn.");
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(QR_BUCKET)
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setForm((f) => ({ ...f, qr_image_path: path }));
      toast.success("Đã tải ảnh QR.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSave() {
    if (!form.bank_name.trim() || !form.account_number.trim() || !form.account_holder.trim()) {
      toast.error("Vui lòng điền đầy đủ ngân hàng, số tài khoản, chủ tài khoản.");
      return;
    }
    startTransition(async () => {
      const payload = {
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        account_holder: form.account_holder.trim(),
        qr_image_path: form.qr_image_path,
      };
      const result = editingId
        ? await updateMyPayoutMethod(editingId, payload)
        : await createMyPayoutMethod({ ...payload, is_primary: !hasPrimary });
      if (result.success && result.data) {
        if (editingId) {
          setMethods((prev) =>
            prev.map((m) => (m.id === editingId ? result.data! : m)),
          );
        } else {
          setMethods((prev) => [result.data!, ...prev]);
        }
        toast.success(editingId ? "Đã cập nhật." : "Đã thêm tài khoản nhận lương.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Không lưu được.");
      }
    });
  }

  async function handleSetPrimary(m: TeacherPayoutMethodRow) {
    if (m.is_primary) return;
    startTransition(async () => {
      const r = await updateMyPayoutMethod(m.id, { is_primary: true });
      if (r.success) {
        setMethods((prev) =>
          prev.map((row) => ({ ...row, is_primary: row.id === m.id })),
        );
        toast.success("Đã đặt làm tài khoản mặc định.");
      } else {
        toast.error(r.error);
      }
    });
  }

  async function handleDelete(m: TeacherPayoutMethodRow) {
    const ok = await confirm({
      title: `Xoá tài khoản ${m.bank_name}?`,
      variant: "danger",
      confirmLabel: "Xoá",
      description:
        "Quản trị viên trung tâm sẽ không thấy tài khoản này nữa. Bạn có thể thêm lại bất cứ lúc nào.",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteMyPayoutMethod(m.id);
      if (r.success) {
        setMethods((prev) => prev.filter((row) => row.id !== m.id));
        toast.success("Đã xoá.");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!hasAny && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Bạn chưa cấu hình tài khoản nhận lương.
            </p>
            <p className="mt-0.5 text-xs text-amber-800/90">
              Quản trị viên cần thông tin chuyển khoản để chi lương cho bạn.
              Thêm ngân hàng, số tài khoản, và ảnh QR (nếu có) để được trả
              đúng hạn.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
          {methods.length} tài khoản
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </button>
      </div>

      <ul className="space-y-3">
        {methods.map((m) => (
          <PayoutMethodCard
            key={m.id}
            method={m}
            onEdit={() => openEdit(m)}
            onSetPrimary={() => handleSetPrimary(m)}
            onDelete={() => handleDelete(m)}
            pending={isPending}
          />
        ))}
      </ul>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Sửa tài khoản" : "Thêm tài khoản nhận lương"}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Building2 className="h-3.5 w-3.5" />
                    Ngân hàng *
                  </label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="Ví dụ: Vietcombank"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Hash className="h-3.5 w-3.5" />
                    Số tài khoản *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.account_number}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    placeholder="Chỉ chứa số / dấu cách"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <UserIcon className="h-3.5 w-3.5" />
                    Chủ tài khoản *
                  </label>
                  <input
                    type="text"
                    value={form.account_holder}
                    onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                    placeholder="Tên đúng trên thẻ ngân hàng"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" />
                      Mã QR chuyển khoản
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      (tuỳ chọn)
                    </span>
                  </label>
                  <QrUploader
                    currentPath={form.qr_image_path}
                    onUpload={handleUploadQr}
                    onClear={() => setForm({ ...form, qr_image_path: null })}
                    isUploading={isUploading}
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                    Ảnh chỉ hiển thị cho quản trị viên trung tâm khi họ chi
                    lương. Định dạng JPG / PNG, tối đa 4 MB.
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingId ? (
                    "Lưu thay đổi"
                  ) : (
                    "Thêm tài khoản"
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

// ── Subcomponents ───────────────────────────────────────────────────────

function PayoutMethodCard({
  method,
  onEdit,
  onSetPrimary,
  onDelete,
  pending,
}: {
  method: TeacherPayoutMethodRow;
  onEdit: () => void;
  onSetPrimary: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!method.qr_image_path) {
      setQrUrl(null);
      return;
    }
    let active = true;
    getQrSignedUrl(method.qr_image_path).then((r) => {
      if (active && r.success && r.data) setQrUrl(r.data);
    });
    return () => {
      active = false;
    };
  }, [method.qr_image_path]);

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start gap-4 p-4">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="QR chuyển khoản"
            className="h-20 w-20 flex-shrink-0 rounded-xl border border-slate-100 object-cover"
          />
        ) : (
          <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-300">
            <Camera className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {method.bank_name}
            </p>
            {method.is_primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                <Star className="h-3 w-3" />
                Mặc định
              </span>
            )}
            {!method.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Đã tắt
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm tabular-nums text-slate-700">
            {maskAccount(method.account_number)}
          </p>
          <p className="text-xs text-slate-500">{method.account_holder}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {!method.is_primary && (
            <button
              type="button"
              onClick={onSetPrimary}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              title="Đặt làm tài khoản mặc định"
            >
              <Check className="h-3.5 w-3.5" />
              Mặc định
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Sửa
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            aria-label="Xoá"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function QrUploader({
  currentPath,
  onUpload,
  onClear,
  isUploading,
}: {
  currentPath: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  isUploading: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPath) {
      setPreviewUrl(null);
      return;
    }
    let active = true;
    getQrSignedUrl(currentPath).then((r) => {
      if (active && r.success && r.data) setPreviewUrl(r.data);
    });
    return () => {
      active = false;
    };
  }, [currentPath]);

  return (
    <div className="flex items-center gap-3">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="QR đã tải"
          className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
        />
      ) : (
        <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
          <Camera className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <Upload className="h-3.5 w-3.5" />
          {isUploading ? "Đang tải..." : currentPath ? "Đổi ảnh" : "Chọn ảnh"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {currentPath && (
          <button
            type="button"
            onClick={onClear}
            className="w-fit text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            Bỏ ảnh
          </button>
        )}
      </div>
    </div>
  );
}
