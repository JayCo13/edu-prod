"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createSchoolYear,
  deleteSchoolYear,
  updateSchoolYear,
  type SchoolYearInput,
} from "@/modules/school-payroll/actions";
import type { SchoolYearPeriodRow } from "@/modules/school-payroll/types";

interface Props {
  years: SchoolYearPeriodRow[];
  onChange: (years: SchoolYearPeriodRow[]) => void;
  onSelect: (yearId: string) => void;
}

export default function SchoolYearsTab({ years, onChange, onSelect }: Props) {
  const [editing, setEditing] = useState<SchoolYearPeriodRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(input: SchoolYearInput) {
    const current = editing;
    if (!current) return;
    startTransition(async () => {
      if (typeof current === "string") {
        // current === "new"
        const r = await createSchoolYear(input);
        if (r.success) {
          onChange([r.data, ...years]);
          onSelect(r.data.id);
          setEditing(null);
        } else alert(r.error);
      } else {
        const r = await updateSchoolYear(current.id, input);
        if (r.success) {
          onChange(years.map((y) => (y.id === current.id ? r.data : y)));
          setEditing(null);
        } else alert(r.error);
      }
    });
  }

  function handleDelete(year: SchoolYearPeriodRow) {
    if (!confirm(`Xóa năm học ${year.year_label}? Mọi cấu hình GV trong năm này sẽ mất.`))
      return;
    startTransition(async () => {
      const r = await deleteSchoolYear(year.id);
      if (r.success) onChange(years.filter((y) => y.id !== year.id));
      else alert(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm năm học
        </button>
      </div>

      {years.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">Chưa có năm học</p>
          <p className="mt-1 text-xs text-slate-500">
            Tạo năm học (1/7 năm trước → 30/6 năm sau) để bắt đầu cấu hình.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Năm học</th>
                <th className="px-3 py-2.5 text-left">Khoảng ngày</th>
                <th className="px-3 py-2.5 text-right">Số tuần dạy</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {years.map((y) => (
                <tr key={y.id}>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {y.year_label}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {y.start_date} → {y.end_date}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {y.teaching_weeks}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(y)}
                        disabled={pending}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(y)}
                        disabled={pending}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <YearForm
          initial={typeof editing === "string" ? null : editing}
          onSubmit={handleSave}
          onClose={() => setEditing(null)}
          pending={pending}
        />
      )}
    </div>
  );
}

function YearForm({
  initial,
  onSubmit,
  onClose,
  pending,
}: {
  initial: SchoolYearPeriodRow | null;
  onSubmit: (input: SchoolYearInput) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [yearLabel, setYearLabel] = useState(
    initial?.year_label ?? `${currentYear}-${currentYear + 1}`,
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? `${currentYear}-07-01`);
  const [endDate, setEndDate] = useState(initial?.end_date ?? `${currentYear + 1}-06-30`);
  const [teachingWeeks, setTeachingWeeks] = useState(initial?.teaching_weeks ?? 37);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900">
          {initial ? "Sửa năm học" : "Thêm năm học"}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              year_label: yearLabel,
              start_date: startDate,
              end_date: endDate,
              teaching_weeks: teachingWeeks,
            });
          }}
          className="mt-4 space-y-3"
        >
          <Field>
            <Label>Năm học (YYYY-YYYY)</Label>
            <Input
              required
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="2025-2026"
              pattern="\d{4}-\d{4}"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label>Bắt đầu</Label>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field>
              <Label>Kết thúc</Label>
              <Input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <Label>Số tuần dạy (TT 05 mặc định 37)</Label>
            <Input
              type="number"
              required
              min={1}
              max={52}
              value={teachingWeeks}
              onChange={(e) => setTeachingWeeks(Number(e.target.value))}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}
