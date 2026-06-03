"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Receipt, X } from "lucide-react";

import {
  bulkGeneratePayments,
  previewBulkPayments,
} from "@/modules/students/actions";

interface Props {
  classId: string;
  className: string;
  onClose: () => void;
  onDone: (created: number) => void;
}

export default function BulkPaymentsModal({
  classId,
  className,
  onClose,
  onDone,
}: Props) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const threeMonthsAhead = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const [startMonth, setStartMonth] = useState(nextMonth);
  const [endMonth, setEndMonth] = useState(threeMonthsAhead);
  const [defaultDay, setDefaultDay] = useState("5");
  const [preview, setPreview] = useState<{
    months: string[];
    eligible_enrollments: number;
    will_create: number;
    will_skip_existing: number;
    skip_no_tuition: number;
    skip_non_monthly: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewInput = useMemo(
    () => ({
      class_id: classId,
      start_month: startMonth,
      end_month: endMonth,
      default_payment_day: Number(defaultDay) || 5,
    }),
    [classId, startMonth, endMonth, defaultDay],
  );

  useEffect(() => {
    if (!startMonth || !endMonth || startMonth > endMonth) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewBulkPayments(previewInput).then((r) => {
        if (cancelled) return;
        if (r.success) setPreview(r.data);
        else setPreview(null);
        setPreviewLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewInput, startMonth, endMonth]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!preview || preview.will_create === 0) {
      setError("Không có khoản nào sẽ được tạo. Kiểm tra lại.");
      return;
    }
    startTransition(async () => {
      const r = await bulkGeneratePayments(previewInput);
      if (r.success) onDone(r.data.created);
      else setError(r.error);
    });
  }

  void currentMonth;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Tạo khoản thu hàng tháng
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {className} · áp cho mọi HS đang học chu kỳ tháng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-xs leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">Cách hoạt động</p>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>
                  Sinh khoản thu cho mỗi HS × mỗi tháng trong khoảng đã chọn.
                </li>
                <li>
                  Số tiền = <strong>tuition_amount_vnd</strong> trong đăng ký HS;
                  HS chưa set sẽ bị bỏ qua.
                </li>
                <li>
                  Ngày đóng = <strong>payment_day</strong> trong đăng ký, hoặc giá
                  trị mặc định bên dưới nếu HS chưa có.
                </li>
                <li>
                  Khoản đã tồn tại (cùng HS + cùng ngày đóng) sẽ bị bỏ qua —
                  chạy lại an toàn.
                </li>
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Từ tháng" required>
                <input
                  type="month"
                  required
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Đến tháng" required hint="Tối đa 24 tháng/lần">
                <input
                  type="month"
                  required
                  min={startMonth}
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field
              label="Ngày đóng mặc định"
              hint="Chỉ dùng cho HS chưa set payment_day trong đăng ký. Ngày vượt số ngày của tháng (vd. 31/2) sẽ tự lùi về ngày cuối tháng."
            >
              <input
                type="number"
                min={1}
                max={31}
                value={defaultDay}
                onChange={(e) => setDefaultDay(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Preview */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5">
              {previewLoading ? (
                <p className="text-xs text-slate-500">Đang tính trước…</p>
              ) : preview ? (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2 text-emerald-900">
                    <span className="text-2xl font-bold font-mono tabular-nums">
                      {preview.will_create}
                    </span>
                    <span className="text-sm">khoản sẽ được tạo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-emerald-800">
                    <Stat label="HS đủ điều kiện" value={preview.eligible_enrollments} />
                    <Stat label="Số tháng" value={preview.months.length} />
                    <Stat
                      label="Bỏ qua (đã có)"
                      value={preview.will_skip_existing}
                      muted
                    />
                    <Stat
                      label="HS chưa set học phí"
                      value={preview.skip_no_tuition}
                      muted
                    />
                    {preview.skip_non_monthly > 0 && (
                      <Stat
                        label="HS chu kỳ khác (bỏ)"
                        value={preview.skip_non_monthly}
                        muted
                      />
                    )}
                  </div>
                  {preview.months.length > 0 && (
                    <p className="mt-2 text-xs text-emerald-700">
                      Tháng: {preview.months.slice(0, 6).map(toVnMonth).join(" · ")}
                      {preview.months.length > 6 && ` …+${preview.months.length - 6}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Chọn khoảng tháng để xem trước.
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/40 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending || !preview || preview.will_create === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                "Đang tạo…"
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {preview && preview.will_create > 0
                    ? `Tạo ${preview.will_create} khoản`
                    : "Tạo khoản"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? "text-slate-500" : ""}>{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${muted ? "text-slate-500" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function toVnMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}
