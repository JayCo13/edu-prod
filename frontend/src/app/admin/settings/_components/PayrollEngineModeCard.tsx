"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  setPayrollEngineMode,
  type EngineMode,
} from "@/modules/payroll/engine-mode-actions";

interface Props {
  initialMode: EngineMode;
}

const MODES: {
  value: EngineMode;
  label: string;
  desc: string;
  badge?: string;
}[] = [
  {
    value: "OLD",
    label: "Cũ — mặc định",
    desc: "Engine hiện tại: 1 đơn giá / giáo viên, không co-teaching. An toàn nhất.",
  },
  {
    value: "SHADOW",
    label: "Song song — so sánh",
    desc: "Chạy CẢ HAI engine cho mỗi kỳ. Lưu kết quả cũ vào bảng lương; engine mới chỉ ghi log diff để bạn so sánh. Số tiền chi cho GV không đổi. Khuyên dùng 1-2 kỳ trước khi chuyển sang Mới.",
    badge: "Khuyên dùng trước khi chuyển",
  },
  {
    value: "NEW",
    label: "Mới — đã verified",
    desc: "Engine mới (rate_rules + co-teaching) là nguồn chính. Chỉ chuyển sang đây sau khi shadow đã ổn định.",
  },
];

export default function PayrollEngineModeCard({ initialMode }: Props) {
  const [mode, setMode] = useState<EngineMode>(initialMode);
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function handleChange(next: EngineMode) {
    if (next === mode) return;
    startTransition(async () => {
      const r = await setPayrollEngineMode({ mode: next });
      if (r.success) {
        setMode(next);
        setSavedMsg(`Đã đổi sang chế độ "${labelOf(next)}".`);
        setTimeout(() => setSavedMsg(null), 3000);
      } else {
        alert(r.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Engine bảng lương
        </p>
        <h2 className="mt-1 text-base font-bold text-slate-900">
          Chế độ tính lương
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Quyết định engine nào được dùng để tính lương khi tạo kỳ mới.
          Đổi chế độ được ghi vào nhật ký thay đổi (audit log).
        </p>
      </div>

      <div className="space-y-2">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`group block cursor-pointer rounded-xl border p-3 transition-colors ${
              mode === m.value
                ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500"
                : "border-slate-200 hover:border-slate-300"
            } ${pending ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="engine_mode"
                checked={mode === m.value}
                onChange={() => handleChange(m.value)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {m.label}
                  </p>
                  {m.badge && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {m.desc}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>

      {pending && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Đang lưu…
        </p>
      )}
      {savedMsg && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-700">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {savedMsg}
        </p>
      )}
    </section>
  );
}

function labelOf(m: EngineMode): string {
  return MODES.find((x) => x.value === m)?.label ?? m;
}
