"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  listQuotas,
  upsertQuota,
  type QuotaInput,
} from "@/modules/school-payroll/actions";
import {
  REDUCTION_DEFAULTS,
  type QuotaReductionEntry,
  type QuotaReductionType,
  type TeacherPeriodQuotaRow,
} from "@/modules/school-payroll/types";

interface Props {
  teacherId: string;
  schoolYearId: string;
}

export default function QuotaForm({ teacherId, schoolYearId }: Props) {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<TeacherPeriodQuotaRow | null>(null);
  const [base, setBase] = useState<string>("");
  const [reductions, setReductions] = useState<QuotaReductionEntry[]>([]);
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    listQuotas(schoolYearId).then((r) => {
      if (r.success) {
        const mine = r.data.find((q) => q.teacher_id === teacherId);
        if (mine) {
          setExisting(mine);
          setBase(mine.base_periods_per_week?.toString() ?? "");
          setReductions((mine.reductions ?? []) as QuotaReductionEntry[]);
        }
      }
      setLoading(false);
    });
  }, [teacherId, schoolYearId]);

  function addReduction(type: QuotaReductionType) {
    setReductions([
      ...reductions,
      {
        type,
        minus: REDUCTION_DEFAULTS[type].default_minus,
        allowance_received: false,
      },
    ]);
  }

  function updateReduction(idx: number, patch: Partial<QuotaReductionEntry>) {
    setReductions(reductions.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeReduction(idx: number) {
    setReductions(reductions.filter((_, i) => i !== idx));
  }

  function handleSave() {
    startTransition(async () => {
      const input: QuotaInput = {
        teacher_id: teacherId,
        school_year_id: schoolYearId,
        base_periods_per_week: base ? Number(base) : null,
        reductions,
      };
      const r = await upsertQuota(input);
      if (r.success) {
        setExisting(r.data);
        setSavedMsg("Đã lưu");
        setTimeout(() => setSavedMsg(null), 2000);
      } else {
        alert(r.error);
      }
    });
  }

  if (loading) return <p className="text-sm text-slate-500">Đang tải…</p>;

  const eligibleCount = reductions.filter((r) => !r.allowance_received).length;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Định mức cơ sở (để trống = dùng default trường)
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="19 (THCS) / 17 (THPT) / 23 (TH)"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Giảm trừ kiêm nhiệm (TT 05/2025 — tối đa 2)
          </p>
          {eligibleCount > 2 && (
            <span className="text-xs font-semibold text-amber-700">
              ⚠ Vượt 2 — chỉ áp 2 đầu
            </span>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {reductions.map((r, idx) => (
            <div
              key={idx}
              className={`grid gap-2 rounded-xl border p-2.5 sm:grid-cols-[1fr_80px_auto_auto] ${
                idx >= 2 && !r.allowance_received
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-slate-200"
              }`}
            >
              <select
                value={r.type}
                onChange={(e) =>
                  updateReduction(idx, {
                    type: e.target.value as QuotaReductionType,
                    minus: REDUCTION_DEFAULTS[e.target.value as QuotaReductionType].default_minus,
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400"
              >
                {(Object.keys(REDUCTION_DEFAULTS) as QuotaReductionType[]).map((k) => (
                  <option key={k} value={k}>
                    {REDUCTION_DEFAULTS[k].label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={20}
                value={r.minus}
                onChange={(e) =>
                  updateReduction(idx, { minus: Number(e.target.value) || 0 })
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs tabular-nums text-slate-800 outline-none focus:border-slate-400"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={r.allowance_received}
                  onChange={(e) =>
                    updateReduction(idx, { allowance_received: e.target.checked })
                  }
                />
                Đã nhận phụ cấp
              </label>
              <button
                type="button"
                onClick={() => removeReduction(idx)}
                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(REDUCTION_DEFAULTS) as QuotaReductionType[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addReduction(k)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              {REDUCTION_DEFAULTS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        {savedMsg && (
          <span className="text-xs font-semibold text-emerald-600">{savedMsg}</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Đang lưu…" : existing ? "Cập nhật" : "Tạo"}
        </button>
      </div>
    </div>
  );
}
