"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import type {
  RecurringAdjustmentInput,
} from "@/modules/payroll/recurring-actions";
import type { RecurringAdjustmentRow } from "@/modules/payroll/recurring-adjustments";
import type { TenantTeacherRow } from "@/types/database";

interface Props {
  mode: "create" | "edit";
  teachers: TenantTeacherRow[];
  initial?: RecurringAdjustmentRow;
  onSubmit: (input: RecurringAdjustmentInput) => void;
  onClose: () => void;
  pending: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RecurringForm({
  mode,
  teachers,
  initial,
  onSubmit,
  onClose,
  pending,
}: Props) {
  const [teacherId, setTeacherId] = useState<string>(
    initial?.teacher_id ?? teachers[0]?.id ?? "",
  );
  const [type, setType] = useState<"BONUS" | "DEDUCTION">(
    initial?.type ?? "BONUS",
  );
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount_vnd) : "",
  );
  const [reason, setReason] = useState<string>(initial?.reason ?? "");
  const [cycle, setCycle] = useState<"EVERY" | "UNTIL_DATE" | "N_PERIODS_LEFT">(
    initial?.cycle ?? "EVERY",
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    initial?.effective_from ?? today(),
  );
  const [effectiveTo, setEffectiveTo] = useState<string>(
    initial?.effective_to ?? "",
  );
  const [remainingPeriods, setRemainingPeriods] = useState<string>(
    initial?.remaining_periods != null ? String(initial.remaining_periods) : "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      alert("Số tiền phải lớn hơn 0.");
      return;
    }
    onSubmit({
      teacher_id: teacherId,
      type,
      amount_vnd: amt,
      reason: reason.trim(),
      cycle,
      effective_from: effectiveFrom,
      effective_to: cycle === "UNTIL_DATE" ? effectiveTo || null : null,
      remaining_periods:
        cycle === "N_PERIODS_LEFT" && remainingPeriods
          ? Number(remainingPeriods)
          : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">
            {mode === "create" ? "Thêm phụ cấp định kỳ" : "Sửa phụ cấp định kỳ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Teacher */}
          <Field>
            <Label>Giáo viên</Label>
            <select
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </select>
          </Field>

          {/* Type + amount on one row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label>Loại</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "BONUS" | "DEDUCTION")}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="BONUS">Phụ cấp (cộng)</option>
                <option value="DEDUCTION">Khấu trừ (trừ)</option>
              </select>
            </Field>
            <Field>
              <Label>Số tiền (đồng)</Label>
              <input
                type="number"
                min={1}
                step={1000}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </Field>
          </div>

          {/* Reason */}
          <Field>
            <Label>Lý do</Label>
            <input
              type="text"
              required
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Phụ cấp giáo viên chủ nhiệm"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
          </Field>

          {/* Cycle */}
          <Field>
            <Label>Chu kỳ áp dụng</Label>
            <select
              value={cycle}
              onChange={(e) =>
                setCycle(e.target.value as "EVERY" | "UNTIL_DATE" | "N_PERIODS_LEFT")
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            >
              <option value="EVERY">Mỗi kỳ — không giới hạn</option>
              <option value="UNTIL_DATE">Đến ngày — kết thúc tự động</option>
              <option value="N_PERIODS_LEFT">N kỳ còn lại — vd. tạm ứng trả góp</option>
            </select>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {cycle === "EVERY"
                ? "Áp dụng vô thời hạn cho mọi kỳ lương sau ngày bắt đầu. Tạm ngưng bằng nút trên bảng."
                : cycle === "UNTIL_DATE"
                  ? "Tự động dừng khi kỳ lương vượt qua ngày kết thúc."
                  : "Mỗi kỳ APPROVED giảm 1; tự tắt khi về 0."}
            </p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label>Ngày bắt đầu</Label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            </Field>

            {cycle === "UNTIL_DATE" && (
              <Field>
                <Label>Ngày kết thúc</Label>
                <input
                  type="date"
                  required
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </Field>
            )}

            {cycle === "N_PERIODS_LEFT" && (
              <Field>
                <Label>Số kỳ còn lại</Label>
                <input
                  type="number"
                  min={1}
                  required
                  value={remainingPeriods}
                  onChange={(e) => setRemainingPeriods(e.target.value)}
                  placeholder="5"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </Field>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "create" ? "Tạo phụ cấp" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}
