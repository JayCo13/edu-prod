"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  Building2,
  Camera,
  Copy,
  HandCoins,
  Loader2,
  Lock,
  X,
} from "lucide-react";

import type {
  PayrollItemPaymentMethod,
  TeacherPayoutMethodRow,
} from "@/types/database";
import {
  getPrimaryPayoutMethodForTeacher,
  getQrSignedUrl,
} from "@/app/actions/payout-methods";
import { markPayrollItemPaidAction } from "@/modules/payroll/actions";

interface Props {
  itemId: string;
  periodId: string;
  teacherId: string;
  teacherName: string;
  amount: number;
  open: boolean;
  onClose: () => void;
  onPaid: (paidAt: string, method: PayrollItemPaymentMethod) => void;
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

export default function PayoutDialog({
  itemId,
  periodId,
  teacherId,
  teacherName,
  amount,
  open,
  onClose,
  onPaid,
}: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<PayrollItemPaymentMethod>("BANK_TRANSFER");
  const [note, setNote] = useState("");
  // Plain useState — useTransition's `isPending` only tracks the SYNC part
  // of an async callback (the spinner would flip off the moment we hit the
  // first await). We need it to remain true until the server action
  // resolves, so the button stays disabled + spinning the whole time.
  const [pending, setPending] = useState(false);

  const [payoutMethod, setPayoutMethod] = useState<TeacherPayoutMethodRow | null>(null);
  const [loadingMethod, setLoadingMethod] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Pull the teacher's primary payout method (bank info + QR) when opened.
  useEffect(() => {
    if (!open) return;
    setLoadingMethod(true);
    setQrUrl(null);
    setPayoutMethod(null);
    setMethod("BANK_TRANSFER");
    setNote("");
    let active = true;
    getPrimaryPayoutMethodForTeacher(teacherId).then((r) => {
      if (!active) return;
      setLoadingMethod(false);
      if (r.success && r.data) {
        setPayoutMethod(r.data);
        if (r.data.qr_image_path) {
          getQrSignedUrl(r.data.qr_image_path).then((res) => {
            if (active && res.success && res.data) setQrUrl(res.data);
          });
        }
      }
    });
    return () => {
      active = false;
    };
  }, [open, teacherId]);

  function handleCopy(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`Đã sao chép ${label}.`))
      .catch(() => toast.error("Không sao chép được."));
  }

  async function handleConfirm() {
    if (pending) return; // belt + suspenders against double-click
    setPending(true);
    try {
      const r = await markPayrollItemPaidAction({
        itemId,
        periodId,
        method,
        note: note.trim() || undefined,
      });
      if (r.success && r.data) {
        toast.success(
          method === "BANK_TRANSFER"
            ? `Đã ghi nhận chuyển khoản cho ${teacherName}.`
            : `Đã ghi nhận chi tiền mặt cho ${teacherName}.`,
        );
        onPaid(r.data.paidAt, method);
        router.refresh();
        onClose();
      } else {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => !pending && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  Thanh toán
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                  {teacherName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Thực lĩnh:{" "}
                  <span className="font-mono font-semibold tabular-nums text-slate-700">
                    {formatVnd(amount)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-5 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              {/* LEFT — bank info / QR */}
              <section className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  Tài khoản giáo viên
                </p>
                {loadingMethod ? (
                  <div className="grid h-32 place-items-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : !payoutMethod ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <p className="font-semibold">
                      Giáo viên chưa cấu hình tài khoản nhận lương.
                    </p>
                    <p className="mt-0.5 leading-snug text-amber-800/80">
                      Có thể chi tiền mặt và đánh dấu ở dưới, hoặc nhắc giáo
                      viên cập nhật tài khoản trong &quot;Nhận lương&quot;
                      trên dashboard của họ.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Field
                      icon={<Building2 className="h-3.5 w-3.5" />}
                      label="Ngân hàng"
                      value={payoutMethod.bank_name}
                      onCopy={() => handleCopy(payoutMethod.bank_name, "tên ngân hàng")}
                    />
                    <Field
                      icon={
                        <span className="font-mono text-[10px]">#</span>
                      }
                      label="Số tài khoản"
                      value={payoutMethod.account_number}
                      mono
                      onCopy={() => handleCopy(payoutMethod.account_number, "số tài khoản")}
                    />
                    <Field
                      icon={
                        <span className="font-mono text-[10px]">·</span>
                      }
                      label="Chủ tài khoản"
                      value={payoutMethod.account_holder}
                      onCopy={() => handleCopy(payoutMethod.account_holder, "chủ tài khoản")}
                    />
                    {qrUrl ? (
                      <div className="mt-2">
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                          Mã QR
                        </p>
                        <a
                          href={qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-fit"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrUrl}
                            alt="QR chuyển khoản"
                            className="h-40 w-40 rounded-xl border border-slate-200 object-cover"
                          />
                        </a>
                        <p className="mt-1 text-[10.5px] text-slate-400">
                          Bấm vào ảnh để mở lớn / quét bằng app ngân hàng.
                        </p>
                      </div>
                    ) : payoutMethod.qr_image_path ? (
                      <div className="grid h-32 place-items-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-slate-400">
                        Giáo viên chưa tải mã QR.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* RIGHT — choose method + note */}
              <section className="space-y-4">
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                  Hình thức thanh toán
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MethodOption
                    value="BANK_TRANSFER"
                    label="Chuyển khoản"
                    hint="Email gồm 4 số cuối tài khoản"
                    icon={Banknote}
                    current={method}
                    onSelect={setMethod}
                  />
                  <MethodOption
                    value="CASH"
                    label="Tiền mặt"
                    hint="Email xác nhận trực tiếp"
                    icon={HandCoins}
                    current={method}
                    onSelect={setMethod}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Ghi chú gửi giáo viên (tuỳ chọn)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Ví dụ: Đã chuyển 4.200.000đ qua Vietcombank lúc 14:30."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] leading-snug text-slate-500">
                  <p className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <Lock className="h-3 w-3" />
                    Sau khi xác nhận
                  </p>
                  <p className="mt-1">
                    Dòng này sẽ bị khoá, ghi lại người + thời điểm, và hệ
                    thống gửi email cho giáo viên theo nội dung tương ứng.
                    Không thể hoàn tác từ giao diện.
                  </p>
                </div>
              </section>
            </div>

            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
                  method === "BANK_TRANSFER"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : method === "BANK_TRANSFER" ? (
                  "Xác nhận đã chuyển khoản"
                ) : (
                  "Xác nhận đã chi tiền mặt"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  icon,
  label,
  value,
  mono = false,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
          {icon}
          {label}
        </div>
        <p
          className={`mt-0.5 truncate text-sm text-slate-900 ${
            mono ? "font-mono tabular-nums" : ""
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Sao chép"
        title="Sao chép"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MethodOption({
  value,
  label,
  hint,
  icon: Icon,
  current,
  onSelect,
}: {
  value: PayrollItemPaymentMethod;
  label: string;
  hint: string;
  icon: typeof Banknote;
  current: PayrollItemPaymentMethod;
  onSelect: (v: PayrollItemPaymentMethod) => void;
}) {
  const isActive = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={isActive}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
          isActive ? "text-slate-900" : "text-slate-400"
        }`}
      />
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold ${
            isActive ? "text-slate-900" : "text-slate-700"
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
          {hint}
        </p>
      </div>
    </button>
  );
}
