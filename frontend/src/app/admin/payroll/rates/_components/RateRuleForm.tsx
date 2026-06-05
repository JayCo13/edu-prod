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

  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const scopeNeedsId = scope !== "TEACHER_DEFAULT";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Bảng lương · Đơn giá
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              {mode === "create" ? "Thêm đơn giá" : "Sửa đơn giá"}
            </h2>
            {mode === "edit" && selectedTeacher && (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                Áp dụng cho {selectedTeacher.display_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-6 px-6 py-5">
            {/* SECTION 1 — Đối tượng */}
            <Section title="Đối tượng áp dụng">
              <Field label="Giáo viên" required>
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

              <Field
                label="Phạm vi áp dụng"
                required
                hint="Mỗi giáo viên cần ít nhất 1 đơn giá áp dụng cho tất cả lớp. Nếu lớp / khoá có đơn giá riêng, đơn giá đó sẽ được ưu tiên."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["TEACHER_DEFAULT", "Tất cả lớp", "Áp cho mọi lớp của GV"],
                      ["CLASS", "Một lớp", "Mức tiền riêng cho 1 lớp"],
                      ["COURSE", "Một khoá", "Mức tiền riêng cho 1 khoá"],
                    ] as const
                  ).map(([v, label, hint]) => {
                    const active = scope === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setScope(v);
                          setScopeId("");
                        }}
                        className={`rounded-xl border-2 p-3 text-left transition ${
                          active
                            ? "border-indigo-500 bg-indigo-50/60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <p
                          className={`text-sm font-semibold ${
                            active ? "text-indigo-900" : "text-slate-800"
                          }`}
                        >
                          {label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                          {hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {scopeNeedsId && (
                <Field
                  label={scope === "CLASS" ? "Chọn lớp" : "Chọn khoá học"}
                  required
                >
                  <select
                    required
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">
                      — {scope === "CLASS" ? "Chọn lớp" : "Chọn khoá"} —
                    </option>
                    {(scope === "CLASS" ? classes : courses).map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {"name" in item ? item.name : item.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </Section>

            {/* SECTION 2 — Mức tiền */}
            <Section title="Mức tiền">
              <Field label="Hình thức trả lương" required>
                <select
                  value={structure}
                  onChange={(e) =>
                    setStructure(e.target.value as typeof structure)
                  }
                  className={inputCls}
                >
                  <option value="HOURLY">Theo giờ</option>
                  <option value="PER_SESSION">Theo buổi</option>
                  <option value="FIXED_MONTHLY">Cố định theo tháng</option>
                  <option value="HYBRID">
                    Kết hợp (theo giờ + theo buổi + cố định)
                  </option>
                </select>
              </Field>

              <div
                className={`grid gap-3 ${
                  structure === "HYBRID"
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-1"
                }`}
              >
                {showHourly() && (
                  <Field label="Giá mỗi giờ" required>
                    <VndInput
                      value={hourly}
                      onChange={setHourly}
                      placeholder="250.000"
                    />
                  </Field>
                )}
                {showPerSession() && (
                  <Field label="Giá mỗi buổi" required>
                    <VndInput
                      value={perSession}
                      onChange={setPerSession}
                      placeholder="350.000"
                    />
                  </Field>
                )}
                {showFixed() && (
                  <Field label="Lương cố định mỗi tháng" required>
                    <VndInput
                      value={fixedMonthly}
                      onChange={setFixedMonthly}
                      placeholder="10.000.000"
                    />
                  </Field>
                )}
              </div>
            </Section>

            {/* SECTION 3 — Thời gian + ưu tiên */}
            <Section title="Thời gian áp dụng">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Từ ngày" required>
                  <input
                    type="date"
                    required
                    value={effFrom}
                    onChange={(e) => setEffFrom(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Đến ngày" hint="Để trống nếu không giới hạn.">
                  <input
                    type="date"
                    value={effTo}
                    onChange={(e) => setEffTo(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field
                label="Thứ tự ưu tiên"
                hint="Số lớn hơn sẽ được chọn nếu có nhiều đơn giá cùng áp dụng. Để 0 nếu chỉ có 1 đơn giá ở phạm vi này."
              >
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`${inputCls} max-w-[140px]`}
                />
              </Field>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-slate-100 bg-slate-50/40 px-6 py-3.5">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-snug text-slate-400">{hint}</p>}
    </div>
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
