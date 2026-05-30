"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createRateRule,
  deleteRateRule,
  updateRateRule,
  type RateRuleInput,
  type RateRuleRow,
} from "@/modules/payroll/rate-rules-actions";
import type { TenantTeacherRow } from "@/types/database";

import RateRuleForm from "./RateRuleForm";

interface Props {
  initialRules: RateRuleRow[];
  teachers: TenantTeacherRow[];
  classes: { id: string; name: string }[];
  courses: { id: string; title: string }[];
}

export default function RatesPanel({
  initialRules,
  teachers,
  classes,
  courses,
}: Props) {
  const [rules, setRules] = useState(initialRules);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RateRuleRow | null>(null);
  const [pending, startTransition] = useTransition();

  const teacherMap = useMemo(() => {
    const m = new Map<string, TenantTeacherRow>();
    for (const t of teachers) m.set(t.id, t);
    return m;
  }, [teachers]);
  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, c.name);
    return m;
  }, [classes]);
  const courseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of courses) m.set(c.id, c.title);
    return m;
  }, [courses]);

  const visibleRules = useMemo(
    () => (filterTeacher ? rules.filter((r) => r.teacher_id === filterTeacher) : rules),
    [rules, filterTeacher],
  );

  function handleCreate(input: RateRuleInput) {
    startTransition(async () => {
      const r = await createRateRule(input);
      if (r.success) {
        setRules((prev) => [r.data, ...prev]);
        setCreating(false);
      } else {
        alert(r.error);
      }
    });
  }

  function handleUpdate(id: string, input: RateRuleInput) {
    startTransition(async () => {
      const r = await updateRateRule(id, input);
      if (r.success) {
        setRules((prev) => prev.map((x) => (x.id === id ? r.data : x)));
        setEditing(null);
      } else {
        alert(r.error);
      }
    });
  }

  function handleDelete(rule: RateRuleRow) {
    if (rule.scope === "TEACHER_DEFAULT") {
      alert(
        "Không thể xoá đơn giá Mặc định — mỗi giáo viên cần ít nhất 1 fallback. Sửa giá trị nếu cần thay đổi.",
      );
      return;
    }
    if (!confirm("Xoá đơn giá này?")) return;
    startTransition(async () => {
      const r = await deleteRateRule(rule.id);
      if (r.success) setRules((prev) => prev.filter((x) => x.id !== rule.id));
      else alert(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Lọc giáo viên
          </label>
          <select
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400"
          >
            <option value="">— Tất cả —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm đơn giá
        </button>
      </div>

      {visibleRules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Chưa có đơn giá nào.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Mỗi giáo viên cần ít nhất 1 đơn giá Mặc định. Bấm "Thêm đơn giá".
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Giáo viên</th>
                <th className="px-3 py-2.5 text-left">Phạm vi</th>
                <th className="px-3 py-2.5 text-left">Cấu trúc</th>
                <th className="px-3 py-2.5 text-right">Đơn giá</th>
                <th className="px-3 py-2.5 text-left">Hiệu lực</th>
                <th className="px-3 py-2.5 text-right">Ưu tiên</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRules.map((r) => (
                <Row
                  key={r.id}
                  rule={r}
                  teacherName={teacherMap.get(r.teacher_id)?.display_name ?? "—"}
                  scopeName={
                    r.scope === "CLASS"
                      ? classMap.get(r.scope_id ?? "") ?? "Lớp đã xoá"
                      : r.scope === "COURSE"
                        ? courseMap.get(r.scope_id ?? "") ?? "Khoá đã xoá"
                        : "—"
                  }
                  onEdit={() => setEditing(r)}
                  onDelete={() => handleDelete(r)}
                  pending={pending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <RateRuleForm
          mode="create"
          teachers={teachers}
          classes={classes}
          courses={courses}
          onSubmit={handleCreate}
          onClose={() => setCreating(false)}
          pending={pending}
        />
      )}
      {editing && (
        <RateRuleForm
          mode="edit"
          teachers={teachers}
          classes={classes}
          courses={courses}
          initial={editing}
          onSubmit={(input) => handleUpdate(editing.id, input)}
          onClose={() => setEditing(null)}
          pending={pending}
        />
      )}
    </div>
  );
}

function Row({
  rule,
  teacherName,
  scopeName,
  onEdit,
  onDelete,
  pending,
}: {
  rule: RateRuleRow;
  teacherName: string;
  scopeName: string;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const scopeBadge =
    rule.scope === "TEACHER_DEFAULT"
      ? { label: "Mặc định", cls: "bg-slate-100 text-slate-700 ring-slate-200" }
      : rule.scope === "COURSE"
        ? { label: "Khoá học", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" }
        : { label: "Lớp", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  const rateDisplay = (() => {
    if (rule.payment_structure === "HOURLY")
      return rule.hourly_rate ? `${formatVnd(rule.hourly_rate)}/giờ` : "—";
    if (rule.payment_structure === "PER_SESSION")
      return rule.per_session_rate ? `${formatVnd(rule.per_session_rate)}/buổi` : "—";
    if (rule.payment_structure === "FIXED_MONTHLY")
      return rule.fixed_monthly_amount ? `${formatVnd(rule.fixed_monthly_amount)}/tháng` : "—";
    // HYBRID — show all three
    const parts: string[] = [];
    if (rule.hourly_rate) parts.push(`${formatVnd(rule.hourly_rate)}/giờ`);
    if (rule.per_session_rate) parts.push(`${formatVnd(rule.per_session_rate)}/buổi`);
    if (rule.fixed_monthly_amount)
      parts.push(`${formatVnd(rule.fixed_monthly_amount)}/tháng`);
    return parts.join(" + ") || "—";
  })();
  return (
    <tr>
      <td className="px-3 py-2.5 font-medium text-slate-900">{teacherName}</td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${scopeBadge.cls}`}
        >
          {scopeBadge.label}
        </span>
        {rule.scope !== "TEACHER_DEFAULT" && (
          <span className="ml-2 text-xs text-slate-500">{scopeName}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs uppercase tracking-wide text-slate-500">
        {rule.payment_structure}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
        {rateDisplay}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600">
        {rule.effective_from}
        {rule.effective_to ? ` → ${rule.effective_to}` : " → ∞"}
      </td>
      <td className="px-3 py-2.5 text-right text-xs font-mono text-slate-600">
        {rule.priority}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            title="Sửa"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending || rule.scope === "TEACHER_DEFAULT"}
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
            title={
              rule.scope === "TEACHER_DEFAULT"
                ? "Không thể xoá đơn giá mặc định"
                : "Xoá"
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
