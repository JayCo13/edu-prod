"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { bulkEditSessions } from "@/modules/classes/actions";

interface Props {
  sessionIds: string[];
  onClose: () => void;
  onDone: (updated: number) => void;
}

type EditMode = "time" | "duration" | "shift" | "cancel" | "uncancel";

export default function BulkEditSessionsModal({ sessionIds, onClose, onDone }: Props) {
  const [enabled, setEnabled] = useState<Set<EditMode>>(new Set());
  const [newTime, setNewTime] = useState("19:00");
  const [newDuration, setNewDuration] = useState("90");
  const [shiftDays, setShiftDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(m: EditMode) {
    setEnabled((p) => {
      const n = new Set(p);
      if (n.has(m)) n.delete(m);
      else {
        // cancel + uncancel xung khắc
        if (m === "cancel") n.delete("uncancel");
        if (m === "uncancel") n.delete("cancel");
        n.add(m);
      }
      return n;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (enabled.size === 0) {
      setError("Chọn ít nhất 1 thay đổi để áp dụng.");
      return;
    }
    startTransition(async () => {
      const r = await bulkEditSessions({
        session_ids: sessionIds,
        new_time: enabled.has("time") ? newTime : undefined,
        new_duration_minutes: enabled.has("duration") ? Number(newDuration) : undefined,
        shift_days: enabled.has("shift") ? Number(shiftDays) : undefined,
        cancel: enabled.has("cancel") ? true : enabled.has("uncancel") ? false : undefined,
      });
      if (r.success) {
        if (r.data.errors > 0) {
          toast.error(
            `Cập nhật ${r.data.updated}/${sessionIds.length} buổi. ${r.data.errors} buổi lỗi.`,
          );
        } else {
          toast.success(`Đã cập nhật ${r.data.updated} buổi.`);
        }
        onDone(r.data.updated);
      } else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Pencil className="h-4 w-4 text-amber-600" />
              Sửa hàng loạt
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Áp dụng cho <strong>{sessionIds.length}</strong> buổi đã chọn
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
          <div className="space-y-3 px-6 py-5">
            <p className="text-xs text-slate-500">
              Tick các trường muốn đổi. Trường không tick → giữ nguyên ở mọi buổi.
            </p>

            <ToggleField
              label="Đổi giờ bắt đầu"
              on={enabled.has("time")}
              onToggle={() => toggle("time")}
            >
              <input
                type="time"
                disabled={!enabled.has("time")}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-slate-400">
                Ngày của từng buổi giữ nguyên; chỉ thay HH:MM.
              </p>
            </ToggleField>

            <ToggleField
              label="Đổi thời lượng"
              on={enabled.has("duration")}
              onToggle={() => toggle("duration")}
            >
              <input
                type="number"
                min={15}
                max={720}
                disabled={!enabled.has("duration")}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-slate-400">Đơn vị: phút (15–720).</p>
            </ToggleField>

            <ToggleField
              label="Dời ngày"
              on={enabled.has("shift")}
              onToggle={() => toggle("shift")}
            >
              <input
                type="number"
                min={-365}
                max={365}
                disabled={!enabled.has("shift")}
                value={shiftDays}
                onChange={(e) => setShiftDays(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-slate-400">
                Số ngày — dương = lùi về sau, âm = đẩy lên trước. Vd. 7 = dời sau 1 tuần.
              </p>
            </ToggleField>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => toggle("cancel")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  enabled.has("cancel")
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Đánh dấu huỷ
              </button>
              <button
                type="button"
                onClick={() => toggle("uncancel")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  enabled.has("uncancel")
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Bỏ đánh dấu huỷ
              </button>
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
              disabled={pending || enabled.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                "Đang cập nhật…"
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Áp dụng cho {sessionIds.length} buổi
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
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400";

function ToggleField({
  label,
  on,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        on ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50/40"
      }`}
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
        />
        {label}
      </label>
      <div className={`mt-2 space-y-1 ${on ? "" : "opacity-50"}`}>{children}</div>
    </div>
  );
}
