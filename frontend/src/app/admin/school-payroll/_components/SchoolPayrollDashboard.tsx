"use client";

import { useState, useTransition } from "react";
import { Calendar, Settings, FileBarChart, Loader2 } from "lucide-react";

import { setTenantDefaultPeriodsPerWeek } from "@/modules/school-payroll/actions";
import type { SchoolYearPeriodRow } from "@/modules/school-payroll/types";
import type { TenantTeacherRow } from "@/types/database";

import SchoolYearsTab from "./SchoolYearsTab";
import TeacherConfigTab from "./TeacherConfigTab";
import PayrollPreviewTab from "./PayrollPreviewTab";

interface Props {
  initialYears: SchoolYearPeriodRow[];
  teachers: TenantTeacherRow[];
  defaultPeriodsPerWeek: number | null;
  initialSelectedYearId: string | null;
  initialTab: "years" | "config" | "preview";
}

export default function SchoolPayrollDashboard({
  initialYears,
  teachers,
  defaultPeriodsPerWeek,
  initialSelectedYearId,
  initialTab,
}: Props) {
  const [tab, setTab] = useState(initialTab);
  const [years, setYears] = useState(initialYears);
  const [selectedYearId, setSelectedYearId] = useState(initialSelectedYearId);
  const [defaultPpw, setDefaultPpw] = useState(defaultPeriodsPerWeek);
  const [pending, startTransition] = useTransition();
  const [savedDefaultMsg, setSavedDefaultMsg] = useState<string | null>(null);

  function handleDefaultPpwChange(value: string) {
    const n = Number(value);
    if (!n || n < 1 || n > 50) return;
    setDefaultPpw(n);
    startTransition(async () => {
      const r = await setTenantDefaultPeriodsPerWeek(n);
      if (r.success) {
        setSavedDefaultMsg("Đã lưu");
        setTimeout(() => setSavedDefaultMsg(null), 2000);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Default tenant periods per week */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Định mức tiết/tuần mặc định cho trường
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Áp cho mọi giáo viên chưa cấu hình riêng. TH=23, THCS=19, THPT=17,
            DTNT/PT bán trú khác.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={defaultPpw ?? ""}
            onChange={(e) => setDefaultPpw(Number(e.target.value) || null)}
            onBlur={(e) => handleDefaultPpwChange(e.target.value)}
            placeholder="19"
            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm tabular-nums text-slate-800 outline-none focus:border-slate-400"
          />
          <span className="text-xs text-slate-500">tiết/tuần</span>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          {savedDefaultMsg && (
            <span className="text-xs font-semibold text-emerald-600">
              {savedDefaultMsg}
            </span>
          )}
        </div>
      </div>

      {/* Year selector */}
      {years.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Năm học
          </label>
          <select
            value={selectedYearId ?? ""}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year_label} ({y.teaching_weeks} tuần)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <TabButton
          active={tab === "years"}
          onClick={() => setTab("years")}
          icon={<Calendar className="h-4 w-4" />}
          label="Năm học"
        />
        <TabButton
          active={tab === "config"}
          onClick={() => setTab("config")}
          icon={<Settings className="h-4 w-4" />}
          label="Định mức &amp; Đơn giá"
          disabled={!selectedYearId}
        />
        <TabButton
          active={tab === "preview"}
          onClick={() => setTab("preview")}
          icon={<FileBarChart className="h-4 w-4" />}
          label="Bảng lương + Tạm ứng"
          disabled={!selectedYearId}
        />
      </div>

      {/* Tab content */}
      {tab === "years" && (
        <SchoolYearsTab
          years={years}
          onChange={setYears}
          onSelect={setSelectedYearId}
        />
      )}
      {tab === "config" && selectedYearId && (
        <TeacherConfigTab
          schoolYearId={selectedYearId}
          teachers={teachers}
          defaultPpw={defaultPpw}
        />
      )}
      {tab === "preview" && selectedYearId && (
        <PayrollPreviewTab
          schoolYearId={selectedYearId}
          teachers={teachers}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {icon}
      <span dangerouslySetInnerHTML={{ __html: label }} />
    </button>
  );
}
