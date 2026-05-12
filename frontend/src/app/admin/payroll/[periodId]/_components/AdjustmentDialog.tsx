"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addAdjustmentAction } from "@/modules/payroll/actions";

const INPUT_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

interface Props {
  itemId: string;
  periodId: string;
  teacherName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Add a manual adjustment (BONUS or DEDUCTION) to a payroll item.
 * Reason is REQUIRED — PRD §5.8 "Edit individual amount (with reason)".
 */
export default function AdjustmentDialog({
  itemId,
  periodId,
  teacherName,
  open,
  onClose,
}: Props) {
  const [type, setType] = useState<"BONUS" | "DEDUCTION">("BONUS");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const amount = Number(amountStr.replace(/[.,\s]/g, ""));
  const reasonTrimmed = reason.trim();
  const canSave = reasonTrimmed.length > 0 && amount > 0 && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    startTransition(async () => {
      const r = await addAdjustmentAction(itemId, periodId, {
        type,
        amount,
        reason: reasonTrimmed,
      });
      if (r.success) {
        toast.success(`Đã thêm ${type === "BONUS" ? "phụ cấp" : "khấu trừ"} cho ${teacherName}.`);
        setAmountStr("");
        setReason("");
        setType("BONUS");
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Thêm điều chỉnh
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Giáo viên: <span className="font-medium text-slate-700">{teacherName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Loại điều chỉnh
            </span>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                value="BONUS"
                label="Phụ cấp / Thưởng"
                current={type}
                onSelect={setType}
              />
              <TypeOption
                value="DEDUCTION"
                label="Khấu trừ"
                current={type}
                onSelect={setType}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Số tiền (VND)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              disabled={pending}
              placeholder="VD: 500000"
              className={INPUT_CLASS}
            />
            {amount > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                = {amount.toLocaleString("vi-VN")}đ
              </p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Lý do <span className="text-rose-500">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={pending}
              required
              placeholder="VD: Thưởng đi học đầy đủ tháng 4"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-slate-500">
              Bắt buộc nhập lý do. Lý do sẽ xuất hiện trong file Excel và bản
              điện tử của bảng lương.
            </p>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Đang lưu..." : "Lưu điều chỉnh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TypeOption({
  value,
  label,
  current,
  onSelect,
}: {
  value: "BONUS" | "DEDUCTION";
  label: string;
  current: "BONUS" | "DEDUCTION";
  onSelect: (v: "BONUS" | "DEDUCTION") => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
