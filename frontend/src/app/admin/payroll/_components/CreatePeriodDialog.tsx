"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createPayrollPeriodFromTenantAction } from "@/modules/payroll/actions";

/**
 * "Create new period" trigger + modal.
 *
 * Creates an empty DRAFT period for the chosen month boundaries. Items
 * are added separately (seed script today; sessions-module flow later).
 *
 * Inputs are HTML <input type="month"> for an idiomatic month picker
 * and a notes textarea. We derive period_start = the 1st and
 * period_end = the last day of that month (calendar-correct).
 */
export default function CreatePeriodDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => defaultPreviousMonth());
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { start, end } = monthBoundaries(month);
    startTransition(async () => {
      const r = await createPayrollPeriodFromTenantAction({
        period_start: start,
        period_end: end,
        notes,
      });
      if (r.success) {
        toast.success(`Đã tạo kỳ lương tháng ${month}.`);
        setOpen(false);
        router.push(`/admin/payroll/${r.data.id}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Tạo kỳ lương mới
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Tạo kỳ lương mới
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn tháng tính lương. Có thể chỉnh sửa cho đến khi duyệt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Tháng tính lương
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  disabled={pending}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Ghi chú (tùy chọn)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  disabled={pending}
                  className={INPUT_CLASS}
                  placeholder="VD: Lương tháng có thưởng Tết"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Đang tạo..." : "Tạo kỳ lương"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const INPUT_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

function defaultPreviousMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function monthBoundaries(monthInput: string): { start: string; end: string } {
  // monthInput is "YYYY-MM".
  const [y, m] = monthInput.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  // Last day of the month: day 0 of the *next* month.
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}
