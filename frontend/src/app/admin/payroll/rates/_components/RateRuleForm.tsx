"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { formatVndDigits, parseVndDigits } from "@/lib/format/vnd";
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
  // VND inputs: state lưu chuỗi đã format dấu chấm để render trực tiếp;
  // parseVndDigits khi submit. Đầu vào của initial là số nguyên đồng.
  const [hourly, setHourly] = useState(
    initial?.hourly_rate != null ? formatVndDigits(String(initial.hourly_rate)) : "",
  );
  const [perSession, setPerSession] = useState(
    initial?.per_session_rate != null
      ? formatVndDigits(String(initial.per_session_rate))
      : "",
  );
  const [fixedMonthly, setFixedMonthly] = useState(
    initial?.fixed_monthly_amount != null
      ? formatVndDigits(String(initial.fixed_monthly_amount))
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
      hourly_rate: showHourly() ? parseVndDigits(hourly) : null,
      per_session_rate: showPerSession() ? parseVndDigits(perSession) : null,
      fixed_monthly_amount: showFixed() ? parseVndDigits(fixedMonthly) : null,
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
              <Label>Áp dụng cho</Label>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as typeof scope);
                  setScopeId("");
                }}
                className={inputCls}
              >
                <option value="TEACHER_DEFAULT">Tất cả lớp của giáo viên</option>
                <option value="CLASS">Riêng một lớp cụ thể</option>
                <option value="COURSE">Riêng một khoá học cụ thể</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Mỗi giáo viên cần ít nhất 1 đơn giá áp dụng cho tất cả lớp.
                Nếu lớp / khoá có đơn giá riêng, đơn giá đó sẽ được ưu tiên.
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
            <Label>Hình thức trả lương</Label>
            <select
              value={structure}
              onChange={(e) => setStructure(e.target.value as typeof structure)}
              className={inputCls}
            >
              <option value="HOURLY">Theo giờ</option>
              <option value="PER_SESSION">Theo buổi</option>
              <option value="FIXED_MONTHLY">Cố định theo tháng</option>
              <option value="HYBRID">Kết hợp (theo giờ + theo buổi + cố định)</option>
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            {showHourly() && (
              <Field>
                <Label>Giá mỗi giờ</Label>
                <VndInput value={hourly} onChange={setHourly} placeholder="250.000" />
              </Field>
            )}
            {showPerSession() && (
              <Field>
                <Label>Giá mỗi buổi</Label>
                <VndInput
                  value={perSession}
                  onChange={setPerSession}
                  placeholder="350.000"
                />
              </Field>
            )}
            {showFixed() && (
              <Field>
                <Label>Lương cố định mỗi tháng</Label>
                <VndInput
                  value={fixedMonthly}
                  onChange={setFixedMonthly}
                  placeholder="10.000.000"
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <Label>Áp dụng từ ngày</Label>
              <input
                type="date"
                required
                value={effFrom}
                onChange={(e) => setEffFrom(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field>
              <Label>Áp dụng đến ngày</Label>
              <input
                type="date"
                value={effTo}
                onChange={(e) => setEffTo(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Để trống nếu không giới hạn.
              </p>
            </Field>
            <Field>
              <Label>Thứ tự ưu tiên</Label>
              <input
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Số lớn hơn sẽ được chọn nếu có nhiều đơn giá cùng áp dụng.
              </p>
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

// Input VND tái dùng — format chấm phân nhóm khi gõ, suffix "đ".
// Cùng pattern với AddStudentsModal / PaymentsClient (lib/format/vnd.ts).
function VndInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatVndDigits(e.target.value))}
        placeholder={placeholder}
        className={`${inputCls} pr-8 font-mono tabular-nums`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
        đ
      </span>
    </div>
  );
}
