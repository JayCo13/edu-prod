"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Power, PowerOff, Trash2, Pencil } from "lucide-react";

import {
  createRecurringAdjustment,
  deleteRecurringAdjustment,
  toggleRecurringAdjustment,
  updateRecurringAdjustment,
  type RecurringAdjustmentInput,
} from "@/modules/payroll/recurring-actions";
import type { RecurringAdjustmentRow } from "@/modules/payroll/recurring-adjustments";
import type { TenantTeacherRow } from "@/types/database";

import RecurringForm from "./RecurringForm";

interface Props {
  initialRules: RecurringAdjustmentRow[];
  teachers: TenantTeacherRow[];
}

export default function RecurringPanel({ initialRules, teachers }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [filterTeacher, setFilterTeacher] = useState<string>("");
  const [editing, setEditing] = useState<RecurringAdjustmentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const teacherMap = useMemo(() => {
    const m = new Map<string, TenantTeacherRow>();
    for (const t of teachers) m.set(t.id, t);
    return m;
  }, [teachers]);

  const visibleRules = useMemo(
    () =>
      filterTeacher
        ? rules.filter((r) => r.teacher_id === filterTeacher)
        : rules,
    [rules, filterTeacher],
  );

  function handleCreate(input: RecurringAdjustmentInput) {
    startTransition(async () => {
      const r = await createRecurringAdjustment(input);
      if (r.success) {
        setRules((prev) => [r.data, ...prev]);
        setCreating(false);
      } else {
        alert(r.error);
      }
    });
  }

  function handleUpdate(id: string, input: RecurringAdjustmentInput) {
    startTransition(async () => {
      const r = await updateRecurringAdjustment(id, input);
      if (r.success) {
        setRules((prev) => prev.map((x) => (x.id === id ? r.data : x)));
        setEditing(null);
      } else {
        alert(r.error);
      }
    });
  }

  function handleToggle(rule: RecurringAdjustmentRow) {
    startTransition(async () => {
      const r = await toggleRecurringAdjustment(rule.id, !rule.is_active);
      if (r.success) {
        setRules((prev) =>
          prev.map((x) =>
            x.id === rule.id ? { ...x, is_active: !rule.is_active } : x,
          ),
        );
      } else {
        alert(r.error);
      }
    });
  }

  function handleDelete(rule: RecurringAdjustmentRow) {
    if (!confirm(`Xóa "${rule.reason}"?`)) return;
    startTransition(async () => {
      const r = await deleteRecurringAdjustment(rule.id);
      if (r.success) {
        setRules((prev) => prev.filter((x) => x.id !== rule.id));
      } else {
        alert(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — filter + add */}
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
          Thêm phụ cấp / khấu trừ
        </button>
      </div>

      {/* Table */}
      {visibleRules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Chưa có phụ cấp định kỳ nào.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Bấm "Thêm phụ cấp / khấu trừ" để khai báo khoản đầu tiên.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Giáo viên</th>
                <th className="px-3 py-2.5 text-left">Loại</th>
                <th className="px-3 py-2.5 text-right">Số tiền</th>
                <th className="px-3 py-2.5 text-left">Chu kỳ</th>
                <th className="px-3 py-2.5 text-left">Lý do</th>
                <th className="px-3 py-2.5 text-left">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRules.map((r) => (
                <Row
                  key={r.id}
                  rule={r}
                  teacherName={teacherMap.get(r.teacher_id)?.display_name ?? "—"}
                  onEdit={() => setEditing(r)}
                  onToggle={() => handleToggle(r)}
                  onDelete={() => handleDelete(r)}
                  pending={pending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <RecurringForm
          mode="create"
          teachers={teachers}
          onSubmit={handleCreate}
          onClose={() => setCreating(false)}
          pending={pending}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <RecurringForm
          mode="edit"
          teachers={teachers}
          initial={editing}
          onSubmit={(input) => handleUpdate(editing.id, input)}
          onClose={() => setEditing(null)}
          pending={pending}
        />
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

function Row({
  rule,
  teacherName,
  onEdit,
  onToggle,
  onDelete,
  pending,
}: {
  rule: RecurringAdjustmentRow;
  teacherName: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const typeColor =
    rule.type === "BONUS"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-rose-50 text-rose-700 ring-rose-200";
  const cycleLabel: Record<typeof rule.cycle, string> = {
    EVERY: "Mỗi kỳ",
    UNTIL_DATE: `Đến ${rule.effective_to ?? "—"}`,
    N_PERIODS_LEFT: `Còn ${rule.remaining_periods ?? 0} kỳ`,
  };
  return (
    <tr className={rule.is_active ? "" : "bg-slate-50/40 opacity-60"}>
      <td className="px-3 py-2.5 font-medium text-slate-900">{teacherName}</td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${typeColor}`}
        >
          {rule.type === "BONUS" ? "Phụ cấp" : "Khấu trừ"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
        {formatVnd(rule.amount_vnd)}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600">{cycleLabel[rule.cycle]}</td>
      <td className="px-3 py-2.5 max-w-[200px] truncate text-slate-700">
        {rule.reason}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
            rule.is_active
              ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
              : "bg-slate-100 text-slate-600 ring-slate-200"
          }`}
        >
          {rule.is_active ? "Đang áp dụng" : "Tạm ngưng"}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            title="Sửa"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            title={rule.is_active ? "Tạm ngưng" : "Kích hoạt"}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            {rule.is_active ? (
              <PowerOff className="h-3.5 w-3.5" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title="Xóa"
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
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
