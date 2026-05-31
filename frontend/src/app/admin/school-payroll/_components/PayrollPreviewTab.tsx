"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Loader2, Wallet } from "lucide-react";

import {
  createOvertimeAdvance,
  previewSchoolPayrollForAllTeachers,
  type SchoolPayrollSummaryRow,
} from "@/modules/school-payroll/engine-actions";
import type { TenantTeacherRow } from "@/types/database";

interface Props {
  schoolYearId: string;
  teachers: TenantTeacherRow[];
}

export default function PayrollPreviewTab({ schoolYearId }: Props) {
  const [rows, setRows] = useState<SchoolPayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    previewSchoolPayrollForAllTeachers(schoolYearId).then((r) => {
      if (cancelled) return;
      if (r.success) setRows(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolYearId, refresh]);

  function handleAdvance(row: SchoolPayrollSummaryRow) {
    const remaining = row.overtime_total_pay_vnd - row.total_advances_vnd;
    if (remaining <= 0) {
      alert("Không có số dư để tạm ứng.");
      return;
    }
    const amountStr = prompt(
      `Tạm ứng cho ${row.teacher_name}\nSố dư còn lại: ${formatVnd(remaining)}\n\nNhập số tiền tạm ứng (đồng):`,
      String(Math.floor(remaining * 0.5)),
    );
    if (!amountStr) return;
    const amount = Number(amountStr.replace(/\D/g, ""));
    if (!amount || amount <= 0) return;
    const notes =
      prompt("Ghi chú (tuỳ chọn):", "Tạm ứng thừa giờ học kỳ 1") ?? "";

    setAdvancing(row.teacher_id);
    startTransition(async () => {
      const r = await createOvertimeAdvance({
        teacher_id: row.teacher_id,
        school_year_id: schoolYearId,
        advance_amount_vnd: amount,
        notes,
      });
      setAdvancing(null);
      if (r.success) {
        setRefresh((k) => k + 1);
      } else {
        alert(r.error);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Đang tính lương toàn trường…</span>
      </div>
    );
  }

  const ok = rows.filter((r) => !r.error);
  const totalPay = ok.reduce((s, r) => s + r.overtime_total_pay_vnd, 0);
  const totalAdvances = ok.reduce((s, r) => s + r.total_advances_vnd, 0);
  const totalNet = ok.reduce((s, r) => s + r.net_settlement_vnd, 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a
          href={`/api/v1/school-payroll/export?year=${schoolYearId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Xuất Excel TT 21
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Tổng GV" value={ok.length.toString()} />
        <Stat
          label="Tổng thừa giờ phải trả"
          value={formatVnd(totalPay)}
          accent="indigo"
        />
        <Stat
          label="Đã tạm ứng"
          value={formatVnd(totalAdvances)}
          accent="amber"
        />
        <Stat
          label="Còn phải chi cuối năm"
          value={formatVnd(totalNet)}
          accent={totalNet >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left">Giáo viên</th>
              <th className="px-3 py-2.5 text-right">Thực dạy / Định mức</th>
              <th className="px-3 py-2.5 text-right">Thừa giờ</th>
              <th className="px-3 py-2.5 text-right">Bị cắt</th>
              <th className="px-3 py-2.5 text-right">Tiền thừa giờ</th>
              <th className="px-3 py-2.5 text-right">Tạm ứng</th>
              <th className="px-3 py-2.5 text-right">Quyết toán</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.teacher_id}>
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {r.teacher_name}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {r.error ? (
                    <span className="text-xs text-rose-600">⚠ {r.error}</span>
                  ) : (
                    <>
                      {r.total_actual_periods} / {r.quota_periods}
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {r.error ? "—" : r.overtime_paid}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-700">
                  {r.error ? "—" : r.overtime_uncovered || "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
                  {r.error ? "—" : formatVnd(r.overtime_total_pay_vnd)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                  {r.error ? "—" : formatVnd(r.total_advances_vnd)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono font-bold tabular-nums ${
                    r.net_settlement_vnd < 0
                      ? "text-rose-700"
                      : "text-emerald-700"
                  }`}
                >
                  {r.error
                    ? "—"
                    : (r.net_settlement_vnd < 0 ? "" : "+") +
                      formatVnd(r.net_settlement_vnd)}
                </td>
                <td className="px-3 py-2.5">
                  {!r.error && r.overtime_total_pay_vnd > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAdvance(r)}
                      disabled={pending && advancing === r.teacher_id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {pending && advancing === r.teacher_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wallet className="h-3 w-3" />
                      )}
                      Tạm ứng
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Lương thừa giờ chi cuối năm học (1/7 → 30/6) theo TT 21/2025. Tạm
        ứng theo tháng/HK được phép — quyết toán cuối năm có thể ra số âm
        nếu đã ứng vượt. Phần vượt 200 tiết KHÔNG được trả thừa giờ.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "indigo" | "amber" | "emerald" | "rose";
}) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
          accent ? colors[accent] : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
