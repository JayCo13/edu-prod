"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createSalaryBasis,
  deleteSalaryBasis,
  listSalaryBasis,
  updateSalaryBasis,
  type SalaryBasisInput,
} from "@/modules/school-payroll/actions";
import type { TeacherSalaryBasisRow } from "@/modules/school-payroll/types";

interface Props {
  teacherId: string;
  schoolYearId: string;
}

export default function SalaryBasisForm({ teacherId, schoolYearId }: Props) {
  const [rows, setRows] = useState<TeacherSalaryBasisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TeacherSalaryBasisRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listSalaryBasis(teacherId, schoolYearId).then((r) => {
      if (r.success) setRows(r.data);
      setLoading(false);
    });
  }, [teacherId, schoolYearId]);

  function handleSave(input: SalaryBasisInput) {
    const current = editing;
    if (!current) return;
    startTransition(async () => {
      if (typeof current === "string") {
        const r = await createSalaryBasis(input);
        if (r.success) {
          setRows([...rows, r.data].sort((a, b) => a.effective_from.localeCompare(b.effective_from)));
          setEditing(null);
        } else alert(r.error);
      } else {
        const r = await updateSalaryBasis(current.id, input);
        if (r.success) {
          setRows(rows.map((x) => (x.id === current.id ? r.data : x)));
          setEditing(null);
        } else alert(r.error);
      }
    });
  }

  function handleDelete(row: TeacherSalaryBasisRow) {
    if (!confirm("Xóa giai đoạn lương này?")) return;
    startTransition(async () => {
      const r = await deleteSalaryBasis(row.id);
      if (r.success) setRows(rows.filter((x) => x.id !== row.id));
    });
  }

  if (loading) return <p className="text-sm text-slate-500">Đang tải…</p>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-xs leading-relaxed text-indigo-900">
        Lương cơ sở (hiện hành 2.340.000đ) hoặc hệ số lương của giáo viên có
        thể thay đổi giữa năm. Mỗi khi thay đổi, hãy thêm một giai đoạn mới
        với <strong>ngày bắt đầu áp dụng</strong>. Hệ thống sẽ tính đơn giá
        tiết theo từng giai đoạn rồi lấy trung bình có trọng số cho cả năm.
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm giai đoạn
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
          Chưa có giai đoạn lương. Thêm 1 giai đoạn để tính đơn giá tiết.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Từ {formatVnDate(r.effective_from)}
                  {r.effective_to
                    ? ` đến ${formatVnDate(r.effective_to)}`
                    : " (không giới hạn)"}
                </p>
                {r.flat_rate_per_period_vnd !== null ? (
                  <p className="mt-0.5 text-xs text-slate-600">
                    Đơn giá cố định: {formatVnd(r.flat_rate_per_period_vnd)}/tiết
                    (trường tư)
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-600">
                    Hệ số {r.salary_coefficient} × lương cơ sở{" "}
                    {formatVnd(r.base_salary_vnd ?? 0)}
                    {(r.position_allowance_vnd ?? 0) > 0 &&
                      ` + chức vụ ${formatVnd(r.position_allowance_vnd!)}`}
                    {(r.other_allowances_vnd ?? 0) > 0 &&
                      ` + phụ cấp khác ${formatVnd(r.other_allowances_vnd!)}`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SalaryForm
          initial={typeof editing === "string" ? null : editing}
          teacherId={teacherId}
          schoolYearId={schoolYearId}
          onSubmit={handleSave}
          onClose={() => setEditing(null)}
          pending={pending}
        />
      )}
    </div>
  );
}

function SalaryForm({
  initial,
  teacherId,
  schoolYearId,
  onSubmit,
  onClose,
  pending,
}: {
  initial: TeacherSalaryBasisRow | null;
  teacherId: string;
  schoolYearId: string;
  onSubmit: (input: SalaryBasisInput) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<"compute" | "flat">(
    initial?.flat_rate_per_period_vnd != null ? "flat" : "compute",
  );
  const [coef, setCoef] = useState(initial?.salary_coefficient?.toString() ?? "");
  const [base, setBase] = useState(initial?.base_salary_vnd?.toString() ?? "2340000");
  const [pos, setPos] = useState(initial?.position_allowance_vnd?.toString() ?? "0");
  const [other, setOther] = useState(initial?.other_allowances_vnd?.toString() ?? "0");
  const [baoLuu, setBaoLuu] = useState(initial?.bao_luu_coefficient?.toString() ?? "0");
  const [flat, setFlat] = useState(initial?.flat_rate_per_period_vnd?.toString() ?? "");
  const [from, setFrom] = useState(initial?.effective_from ?? new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(initial?.effective_to ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900">
          {initial ? "Sửa giai đoạn lương" : "Thêm giai đoạn lương"}
        </h3>

        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("compute")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              mode === "compute" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Theo hệ số lương (trường công)
          </button>
          <button
            type="button"
            onClick={() => setMode("flat")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              mode === "flat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            Đơn giá cố định (trường tư)
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input: SalaryBasisInput = {
              teacher_id: teacherId,
              school_year_id: schoolYearId,
              salary_coefficient: mode === "compute" ? Number(coef) || 0 : null,
              base_salary_vnd: mode === "compute" ? Number(base) || 0 : null,
              position_allowance_vnd: mode === "compute" ? Number(pos) || 0 : 0,
              other_allowances_vnd: mode === "compute" ? Number(other) || 0 : 0,
              bao_luu_coefficient: mode === "compute" ? Number(baoLuu) || 0 : 0,
              flat_rate_per_period_vnd: mode === "flat" ? Number(flat) || 0 : null,
              effective_from: from,
              effective_to: to || null,
            };
            onSubmit(input);
          }}
          className="mt-4 space-y-3"
        >
          {mode === "compute" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field>
                  <Label>Hệ số lương</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={coef}
                    onChange={(e) => setCoef(e.target.value)}
                    placeholder="2.34"
                  />
                </Field>
                <Field>
                  <Label>Lương cơ sở</Label>
                  <Input
                    type="number"
                    step={10000}
                    required
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                    placeholder="2340000"
                  />
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field>
                  <Label>PC chức vụ</Label>
                  <Input type="number" value={pos} onChange={(e) => setPos(e.target.value)} />
                </Field>
                <Field>
                  <Label>PC khác</Label>
                  <Input type="number" value={other} onChange={(e) => setOther(e.target.value)} />
                </Field>
                <Field>
                  <Label>HS bảo lưu</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baoLuu}
                    onChange={(e) => setBaoLuu(e.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : (
            <Field>
              <Label>Đơn giá / tiết (đ)</Label>
              <Input
                type="number"
                step={1000}
                required
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
                placeholder="120000"
              />
            </Field>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Field>
              <Label>Hiệu lực từ</Label>
              <Input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field>
              <Label>Hiệu lực đến (trống = vô hạn)</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>

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

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
