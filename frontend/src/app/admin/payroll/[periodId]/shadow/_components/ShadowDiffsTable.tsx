"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { DiffSummary } from "@/modules/payroll/shadow-diff";
import type { PayrollBreakdown } from "@/modules/payroll/types";

interface DiffRow {
  id: string;
  teacher_id: string;
  old_final_amount: number;
  new_final_amount: number;
  diff_amount: number;
  diff_summary: DiffSummary;
  old_breakdown: PayrollBreakdown;
  new_breakdown: PayrollBreakdown;
}

interface Props {
  diffs: DiffRow[];
  teacherMap: Map<string, string>;
}

export default function ShadowDiffsTable({ diffs, teacherMap }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8" />
            <th className="px-3 py-2.5 text-left">Giáo viên</th>
            <th className="px-3 py-2.5 text-right">Engine cũ</th>
            <th className="px-3 py-2.5 text-right">Engine mới</th>
            <th className="px-3 py-2.5 text-right">Chênh lệch</th>
            <th className="px-3 py-2.5 text-left">Lý do dự đoán</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {diffs.map((d) => {
            const isOpen = expanded === d.id;
            const isDiff = d.diff_amount !== 0;
            return (
              <>
                <tr
                  key={d.id}
                  className={`cursor-pointer hover:bg-slate-50/60 ${
                    isDiff ? "" : "opacity-60"
                  }`}
                  onClick={() => setExpanded(isOpen ? null : d.id)}
                >
                  <td className="px-2 py-2.5">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {teacherMap.get(d.teacher_id) ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {formatVnd(d.old_final_amount)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {formatVnd(d.new_final_amount)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono font-bold tabular-nums ${
                      d.diff_amount > 0
                        ? "text-emerald-700"
                        : d.diff_amount < 0
                          ? "text-rose-700"
                          : "text-slate-500"
                    }`}
                  >
                    {d.diff_amount > 0 ? "+" : ""}
                    {formatVnd(d.diff_amount)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {d.diff_summary.reason_hint ?? "—"}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${d.id}-detail`}>
                    <td colSpan={6} className="px-3 py-3 bg-slate-50/40">
                      <div className="grid gap-3 md:grid-cols-2">
                        <BreakdownCol
                          title="Engine cũ"
                          breakdown={d.old_breakdown}
                          total={d.old_final_amount}
                        />
                        <BreakdownCol
                          title="Engine mới"
                          breakdown={d.new_breakdown}
                          total={d.new_final_amount}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownCol({
  title,
  breakdown,
  total,
}: {
  title: string;
  breakdown: PayrollBreakdown;
  total: number;
}) {
  const rows: { label: string; value: number; mono?: boolean }[] = [
    { label: "Số buổi tính lương", value: breakdown.sessions_paid, mono: true },
    {
      label: "Phút giờ dạy",
      value: breakdown.hours_taught_minutes,
      mono: true,
    },
    { label: "Lương theo giờ", value: breakdown.hourly_pay },
    { label: "Lương theo buổi", value: breakdown.per_session_pay },
    { label: "Lương tháng cố định", value: breakdown.fixed_monthly_pay },
    { label: "Phụ cấp (bonus)", value: breakdown.bonuses },
    { label: "Khấu trừ (deduction)", value: breakdown.deductions },
    {
      label: "Phạt tự động",
      value: breakdown.automatic_penalties,
    },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <table className="mt-2 w-full text-[12.5px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 text-slate-500">{r.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-slate-700">
                {r.mono ? r.value : formatVnd(r.value)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-700">
              Số tiền cuối
            </td>
            <td className="pt-2 text-right font-mono font-bold tabular-nums text-slate-900">
              {formatVnd(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
