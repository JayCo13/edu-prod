"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarRange, Check, X } from "lucide-react";

import {
  bulkCreateSessions,
  previewBulkSessions,
} from "@/modules/classes/actions";

interface Props {
  classId: string;
  className: string;
  onClose: () => void;
  onDone: (created: number) => void;
}

// 0 = CN, 1 = T2, …, 6 = T7. Sort UI cho T2 đầu, CN cuối — UX VN.
const DAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

export default function BulkSessionsModal({ classId, className, onClose, onDone }: Props) {
  const [title, setTitle] = useState("Buổi {n}");
  const [time, setTime] = useState("19:00");
  const [duration, setDuration] = useState("90");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [dows, setDows] = useState<Set<number>>(new Set([1, 3, 5])); // T2/T4/T6 mặc định
  const [preview, setPreview] = useState<{
    count: number;
    first_dates: string[];
    last_dates: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Auto-preview khi đổi input — debounce nhẹ qua deps trigger.
  const previewInput = useMemo(
    () => ({
      class_id: classId,
      title_template: title || "Buổi",
      time,
      duration_minutes: Number(duration) || 90,
      start_date: startDate,
      end_date: endDate,
      days_of_week: [...dows],
    }),
    [classId, title, time, duration, startDate, endDate, dows],
  );

  useEffect(() => {
    if (dows.size === 0 || !startDate || !endDate || startDate > endDate) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewBulkSessions(previewInput).then((r) => {
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
  }, [previewInput, dows.size, startDate, endDate]);

  function toggleDow(v: number) {
    const next = new Set(dows);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setDows(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (dows.size === 0) {
      setError("Chọn ít nhất 1 thứ trong tuần.");
      return;
    }
    startTransition(async () => {
      const r = await bulkCreateSessions(previewInput);
      if (r.success) onDone(r.data.created);
      else setError(r.error);
    });
  }

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
              <CalendarRange className="h-4 w-4 text-indigo-600" />
              Tạo buổi học hàng loạt
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{className}</p>
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
            <Field
              label="Tiêu đề mẫu"
              hint="Dùng {n} cho số thứ tự, {date} cho ngày — vd. “Buổi {n}” → Buổi 1, Buổi 2…"
            >
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="Buổi {n}"
              />
            </Field>

            <Field label="Thứ trong tuần" required hint="Chọn các ngày lớp họp">
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = dows.has(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDow(d.value)}
                      className={`min-w-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        on
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Giờ bắt đầu" required>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Thời lượng (phút)">
                <input
                  type="number"
                  min={15}
                  max={720}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Từ ngày" required>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Đến ngày" required hint="Tối đa 1 năm, 200 buổi/lần">
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Preview */}
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5">
              {previewLoading ? (
                <p className="text-xs text-slate-500">Đang tính trước…</p>
              ) : preview ? (
                preview.count === 0 ? (
                  <p className="text-xs text-rose-700">
                    Không có ngày nào khớp. Kiểm tra lại khoảng + thứ chọn.
                  </p>
                ) : (
                  <div className="text-sm text-indigo-900">
                    <p className="font-semibold">
                      Sẽ tạo <span className="font-mono">{preview.count}</span> buổi
                    </p>
                    <p className="mt-1 text-xs text-indigo-800">
                      Đầu: {preview.first_dates.map(toVnDate).join(" · ")}
                      {preview.last_dates.length > 0 &&
                        preview.last_dates.some((d) => !preview.first_dates.includes(d)) && (
                          <>
                            <br />
                            Cuối:{" "}
                            {preview.last_dates
                              .filter((d) => !preview.first_dates.includes(d))
                              .map(toVnDate)
                              .join(" · ")}
                          </>
                        )}
                    </p>
                  </div>
                )
              ) : (
                <p className="text-xs text-slate-500">
                  Chọn thứ + khoảng ngày để xem trước số buổi.
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
              disabled={pending || dows.size === 0 || !preview || preview.count === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                "Đang tạo…"
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {preview ? `Tạo ${preview.count} buổi` : "Tạo buổi"}
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

function toVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
