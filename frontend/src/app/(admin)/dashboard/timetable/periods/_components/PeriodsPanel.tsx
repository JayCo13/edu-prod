"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import {
  createPeriod,
  deletePeriod,
  seedDefaultPeriods,
} from "@/modules/timetable/actions";
import type { PeriodRow, PeriodShift } from "@/modules/timetable/types";
import { SHIFT_LABEL } from "@/modules/timetable/types";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  initialPeriods: PeriodRow[];
}

function hhmm(t: string): string {
  return t.slice(0, 5);
}

export default function PeriodsPanel({ initialPeriods }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [periods, setPeriods] = useState(initialPeriods);
  const [shift, setShift] = useState<PeriodShift>("SANG");
  const [periodNumber, setPeriodNumber] = useState<number>(
    initialPeriods.filter((p) => p.shift === "SANG").length + 1,
  );
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("07:45");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const sang = periods.filter((p) => p.shift === "SANG");
  const chieu = periods.filter((p) => p.shift === "CHIEU");

  async function handleSeed() {
    const ok = await confirm({
      title: "Tạo khung tiết mặc định?",
      variant: "info",
      confirmLabel: "Tạo khung tiết",
      description:
        "Sẽ tạo 5 tiết SÁNG (7:00–11:20) + 5 tiết CHIỀU (13:30–17:50) theo khung trường THCS phổ biến. Chỉ chạy được khi trung tâm chưa có khung tiết nào.",
    });
    if (!ok) return;
    setSeeding(true);
    try {
      const r = await seedDefaultPeriods();
      if (r.success && r.data) {
        toast.success(`Đã tạo ${r.data.inserted} tiết.`);
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setSeeding(false);
    }
  }

  async function handleCreate() {
    if (start >= end) {
      toast.error("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    setPending(true);
    try {
      const r = await createPeriod({
        shift,
        period_number: periodNumber,
        start_time: start,
        end_time: end,
      });
      if (r.success && r.data) {
        setPeriods((prev) =>
          [...prev, r.data!].sort((a, b) =>
            a.shift === b.shift
              ? a.period_number - b.period_number
              : a.shift.localeCompare(b.shift),
          ),
        );
        toast.success("Đã thêm tiết.");
        setPeriodNumber((n) => n + 1);
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(p: PeriodRow) {
    const ok = await confirm({
      title: `Xoá tiết ${SHIFT_LABEL[p.shift]} T${p.period_number}?`,
      variant: "danger",
      confirmLabel: "Xoá tiết",
      description:
        "Nếu tiết này đang được dùng trên thời khoá biểu, hệ thống sẽ từ chối xoá.",
    });
    if (!ok) return;
    setDeletingId(p.id);
    const r = await deletePeriod(p.id);
    setDeletingId(null);
    if (r.success) {
      setPeriods((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Đã xoá tiết.");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {periods.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
          <div className="text-sm text-indigo-900">
            <p className="font-semibold">Bắt đầu nhanh</p>
            <p className="mt-0.5 text-xs text-indigo-800/80">
              Tạo khung tiết mặc định (5 tiết Sáng + 5 tiết Chiều) rồi chỉnh
              giờ nếu cần.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {seeding ? "Đang tạo..." : "Tạo khung tiết mặc định"}
          </button>
        </div>
      )}

      {/* Create row */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          Thêm tiết
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as PeriodShift)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="SANG">Sáng</option>
            <option value="CHIEU">Chiều</option>
          </select>
          <input
            type="number"
            min={1}
            max={20}
            value={periodNumber}
            onChange={(e) =>
              setPeriodNumber(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            placeholder="Số tiết"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang thêm...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Thêm
              </>
            )}
          </button>
        </div>
      </div>

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Clock className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            Chưa có khung tiết nào.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ShiftColumn
            label="Buổi sáng"
            periods={sang}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
          <ShiftColumn
            label="Buổi chiều"
            periods={chieu}
            deletingId={deletingId}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

function ShiftColumn({
  label,
  periods,
  deletingId,
  onDelete,
}: {
  label: string;
  periods: PeriodRow[];
  deletingId: string | null;
  onDelete: (p: PeriodRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
      </div>
      {periods.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs italic text-slate-400">
          Chưa có tiết.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {periods.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-700">
                  T{p.period_number}
                </div>
                <div>
                  <p className="font-mono text-sm tabular-nums text-slate-900">
                    {hhmm(p.start_time)} – {hhmm(p.end_time)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(p)}
                disabled={deletingId === p.id}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                aria-label="Xoá tiết"
              >
                {deletingId === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
