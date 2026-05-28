"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Settings2, X, AlertCircle } from "lucide-react";

import {
  type PayoutScheduleSummary,
  setPayoutScheduleAction,
} from "@/modules/payroll/actions";

interface Props {
  schedule: PayoutScheduleSummary;
}

function formatDdMmYyyy(iso: string): string {
  // schedule.next_payout_date is YYYY-MM-DD (string, no timezone math needed).
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function PayoutScheduleCard({ schedule }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>(
    schedule.payout_day != null ? String(schedule.payout_day) : "",
  );
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const parsed = day.trim() === "" ? null : parseInt(day, 10);
    if (parsed != null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 31)) {
      toast.error("Ngày trả lương phải trong khoảng 1–31.");
      return;
    }
    startTransition(async () => {
      const r = await setPayoutScheduleAction({ payout_day: parsed });
      if (r.success) {
        toast.success(
          parsed
            ? `Đã đặt ngày trả lương: ngày ${parsed} hàng tháng.`
            : "Đã tắt lịch trả lương tự động.",
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
          schedule.due_now
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${
              schedule.due_now
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {schedule.due_now ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
              Lịch trả lương
            </p>
            {schedule.payout_day == null ? (
              <p className="mt-0.5 text-sm text-slate-700">
                Chưa cấu hình lịch trả lương tự động.
                <span className="ml-1 text-slate-400">
                  Đặt ngày trả lương để hệ thống tự tạo bảng lương mỗi tháng.
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-800">
                Trả lương ngày{" "}
                <span className="font-semibold tabular-nums">
                  {schedule.payout_day}
                </span>{" "}
                hàng tháng.
                {schedule.next_payout_date && (
                  <span className="ml-1 text-slate-500">
                    Kỳ tới:{" "}
                    <span className="font-semibold tabular-nums text-slate-700">
                      {formatDdMmYyyy(schedule.next_payout_date)}
                    </span>
                    .
                  </span>
                )}
                {schedule.due_now && (
                  <span className="ml-1 font-semibold text-amber-700">
                    Đến hạn — bảng lương tháng trước sẽ được tạo tự động.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {schedule.payout_day == null ? "Cấu hình" : "Đổi ngày"}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Lịch trả lương hàng tháng
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn ngày trong tháng để hệ thống tự tạo bảng lương cho tháng
                  trước đó. Để trống nếu muốn tạo thủ công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Ngày trả lương (1–31)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="Ví dụ: 5"
                disabled={pending}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
              />
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Nếu chọn 31, tháng có ít ngày hơn sẽ tự dùng ngày cuối cùng
                (ví dụ: tháng 2 → 28 hoặc 29).
              </p>
            </label>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setDay("");
                }}
                disabled={pending || day === ""}
                className="text-xs font-medium text-slate-500 transition-colors hover:text-rose-600 disabled:opacity-40"
              >
                Tắt lịch tự động
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={pending}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
