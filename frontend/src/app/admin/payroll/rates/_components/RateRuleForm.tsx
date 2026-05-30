"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import type {
  RateRuleInput,
  RateRuleRow,
} from "@/modules/payroll/rate-rules-actions";
import type { TenantTeacherRow } from "@/types/database";

interface Props {
  mode: "create" | "edit";
  teachers: TenantTeacherRow[];
  classes: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  initial?: RateRuleRow;
  onSubmit: (input: RateRuleInput) => void;
  onClose: () => void;
  pending: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RateRuleForm({
  mode,
  teachers,
  classes,
  courses,
  initial,
  onSubmit,
  onClose,
  pending,
}: Props) {
  const [teacherId, setTeacherId] = useState(
    initial?.teacher_id ?? teachers[0]?.id ?? "",
  );
  const [scope, setScope] = useState<"TEACHER_DEFAULT" | "COURSE" | "CLASS">(
    initial?.scope ?? "TEACHER_DEFAULT",
  );
  const [scopeId, setScopeId] = useState<string>(initial?.scope_id ?? "");
  const [structure, setStructure] = useState<
    "HOURLY" | "PER_SESSION" | "FIXED_MONTHLY" | "HYBRID"
  >(initial?.payment_structure ?? "HOURLY");
  const [hourly, setHourly] = useState(
    initial?.hourly_rate != null ? String(initial.hourly_rate) : "",
  );
  const [perSession, setPerSession] = useState(
    initial?.per_session_rate != null ? String(initial.per_session_rate) : "",
  );
  const [fixedMonthly, setFixedMonthly] = useState(
    initial?.fixed_monthly_amount != null
      ? String(initial.fixed_monthly_amount)
      : "",
  );
  const [effFrom, setEffFrom] = useState(initial?.effective_from ?? today());
  const [effTo, setEffTo] = useState(initial?.effective_to ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));

  function showHourly() {
    return structure === "HOURLY" || structure === "HYBRID";
  }
  function showPerSession() {
    return structure === "PER_SESSION" || structure === "HYBRID";
  }
  function showFixed() {
    return structure === "FIXED_MONTHLY" || structure === "HYBRID";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scope !== "TEACHER_DEFAULT" && !scopeId) {
      alert("Vui lòng chọn lớp / khoá tương ứng.");
      return;
    }
    onSubmit({
      teacher_id: teacherId,
      scope,
      scope_id: scope === "TEACHER_DEFAULT" ? null : scopeId,
      payment_structure: structure,
      hourly_rate: showHourly() ? Number(hourly) || 0 : null,
      per_session_rate: showPerSession() ? Number(perSession) || 0 : null,
      fixed_monthly_amount: showFixed() ? Number(fixedMonthly) || 0 : null,
      effective_from: effFrom,
      effective_to: effTo || null,
      priority: Number(priority) || 0,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">
            {mode === "create" ? "Thêm đơn giá" : "Sửa đơn giá"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <Field>
            <Label>Giáo viên</Label>
            <select
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={inputCls}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label>Phạm vi</Label>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as typeof scope);
                  setScopeId("");
                }}
                className={inputCls}
              >
                <option value="TEACHER_DEFAULT">Mặc định (fallback)</option>
                <option value="COURSE">Khoá học cụ thể</option>
                <option value="CLASS">Lớp cụ thể</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Mỗi GV cần ít nhất 1 đơn giá Mặc định. Lớp ≻ Khoá ≻ Mặc định.
              </p>
            </Field>
            {scope === "COURSE" && (
              <Field>
                <Label>Khoá học</Label>
                <select
                  required
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Chọn khoá —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {scope === "CLASS" && (
              <Field>
                <Label>Lớp</Label>
                <select
                  required
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Chọn lớp —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field>
            <Label>Cấu trúc lương</Label>
            <select
              value={structure}
              onChange={(e) => setStructure(e.target.value as typeof structure)}
              className={inputCls}
            >
              <option value="HOURLY">Theo giờ (HOURLY)</option>
              <option value="PER_SESSION">Theo buổi (PER_SESSION)</option>
              <option value="FIXED_MONTHLY">Lương tháng cố định</option>
              <option value="HYBRID">Kết hợp (HYBRID)</option>
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            {showHourly() && (
              <Field>
                <Label>Giá / giờ (đ)</Label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={hourly}
                  onChange={(e) => setHourly(e.target.value)}
                  placeholder="250000"
                  className={inputCls}
                />
              </Field>
            )}
            {showPerSession() && (
              <Field>
                <Label>Giá / buổi (đ)</Label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={perSession}
                  onChange={(e) => setPerSession(e.target.value)}
                  placeholder="350000"
                  className={inputCls}
                />
              </Field>
            )}
            {showFixed() && (
              <Field>
                <Label>Lương tháng (đ)</Label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={fixedMonthly}
                  onChange={(e) => setFixedMonthly(e.target.value)}
                  placeholder="10000000"
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <Label>Hiệu lực từ</Label>
              <input
                type="date"
                required
                value={effFrom}
                onChange={(e) => setEffFrom(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field>
              <Label>Hiệu lực đến</Label>
              <input
                type="date"
                value={effTo}
                onChange={(e) => setEffTo(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-500">Để trống = vô thời hạn</p>
            </Field>
            <Field>
              <Label>Ưu tiên</Label>
              <input
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-500">Cao = thắng tie-break</p>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "create" ? "Tạo đơn giá" : "Lưu thay đổi"}
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
