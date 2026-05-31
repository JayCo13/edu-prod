"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Settings, X } from "lucide-react";

import {
  getEffectiveQuotaForTeacher,
  getPeriodRateForTeacher,
} from "@/modules/school-payroll/actions";
import type {
  EffectiveQuota,
  PeriodRateForYear,
} from "@/modules/school-payroll/types";
import type { TenantTeacherRow } from "@/types/database";

import QuotaForm from "./QuotaForm";
import SalaryBasisForm from "./SalaryBasisForm";

interface Props {
  schoolYearId: string;
  teachers: TenantTeacherRow[];
  defaultPpw: number | null;
}

interface TeacherSnap {
  teacher: TenantTeacherRow;
  quota: EffectiveQuota | null;
  rate: PeriodRateForYear | null;
  quotaErr?: string;
  rateErr?: string;
}

export default function TeacherConfigTab({
  schoolYearId,
  teachers,
}: Props) {
  const [snaps, setSnaps] = useState<TeacherSnap[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{
    teacher: TenantTeacherRow;
    tab: "quota" | "salary";
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const results: TeacherSnap[] = [];
      for (const t of teachers) {
        const [qRes, rRes] = await Promise.all([
          getEffectiveQuotaForTeacher(t.id, schoolYearId),
          getPeriodRateForTeacher(t.id, schoolYearId),
        ]);
        results.push({
          teacher: t,
          quota: qRes.success ? qRes.data : null,
          quotaErr: qRes.success ? undefined : qRes.error,
          rate: rRes.success ? rRes.data : null,
          rateErr: rRes.success ? undefined : rRes.error,
        });
      }
      if (!cancelled) {
        setSnaps(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teachers, schoolYearId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Đang tải cấu hình GV…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left">Giáo viên</th>
              <th className="px-3 py-2.5 text-right">Định mức</th>
              <th className="px-3 py-2.5 text-left">Giảm trừ</th>
              <th className="px-3 py-2.5 text-right">Đơn giá tiết</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snaps.map((s) => (
              <tr key={s.teacher.id}>
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {s.teacher.display_name}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {s.quota ? (
                    <span className="font-mono tabular-nums text-slate-900">
                      {s.quota.effective_periods_per_week} tiết/tuần
                      <span className="ml-1 text-xs text-slate-400">
                        ({s.quota.effective_periods_per_year}/năm)
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">
                      ⚠ {s.quotaErr ?? "Chưa cấu hình"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {s.quota?.applied_reductions.length
                    ? s.quota.applied_reductions
                        .map((r) => `${r.type} (-${r.minus})`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {s.rate ? (
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatVnd(s.rate.weighted_avg_rate_per_period_vnd)}
                      <span className="ml-1 text-xs text-slate-400">
                        ({s.rate.segments.length} GĐ)
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">
                      ⚠ {s.rateErr ?? "Chưa cấu hình"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing({ teacher: s.teacher, tab: "quota" })}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Định mức
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing({ teacher: s.teacher, tab: "salary" })}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Đơn giá
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDrawer
          teacher={editing.teacher}
          schoolYearId={schoolYearId}
          initialTab={editing.tab}
          onClose={() => {
            setEditing(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function EditDrawer({
  teacher,
  schoolYearId,
  initialTab,
  onClose,
}: {
  teacher: TenantTeacherRow;
  schoolYearId: string;
  initialTab: "quota" | "salary";
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">
              {teacher.display_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 bg-slate-50/40 px-5 py-2">
          <button
            type="button"
            onClick={() => setTab("quota")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "quota"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Định mức + Giảm trừ
          </button>
          <button
            type="button"
            onClick={() => setTab("salary")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "salary"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cơ sở tính lương (time-series)
          </button>
        </div>

        <div className="p-5">
          {tab === "quota" && (
            <QuotaForm teacherId={teacher.id} schoolYearId={schoolYearId} />
          )}
          {tab === "salary" && (
            <SalaryBasisForm
              teacherId={teacher.id}
              schoolYearId={schoolYearId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
