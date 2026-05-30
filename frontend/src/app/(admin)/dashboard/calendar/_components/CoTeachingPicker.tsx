"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2, Users, X } from "lucide-react";

import {
  clearSessionTeachers,
  getSessionTeachers,
  setSessionTeachers,
} from "@/modules/payroll/session-teachers-actions";
import type { TenantTeacherRow } from "@/types/database";

interface Props {
  sessionId: string;
  teachers: Pick<TenantTeacherRow, "id" | "display_name">[];
  assignedTeacherId: string;
  onClose: () => void;
}

interface Slot {
  teacher_id: string;
  pay_share_pct: number;
}

/**
 * Modal cấu hình co-teaching cho 1 buổi.
 *
 * UX:
 *   • Mặc định = solo (1 dòng: assigned_teacher với 100%).
 *   • Admin thêm dòng → chọn GV + tỷ lệ.
 *   • Validate tổng = 100, no duplicate.
 *   • Warning khi GV được pick có FIXED_MONTHLY → "share không áp cho
 *     phần lương cứng tháng; chỉ chia phần HOURLY/PER_SESSION".
 */
export default function CoTeachingPicker({
  sessionId,
  teachers,
  assignedTeacherId,
  onClose,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionTeachers(sessionId).then((r) => {
      if (cancelled) return;
      if (r.success && r.data.length > 0) {
        setSlots(r.data.map((d) => ({ teacher_id: d.teacher_id, pay_share_pct: d.pay_share_pct })));
      } else {
        // Default: solo session — assigned_teacher 100%.
        setSlots([{ teacher_id: assignedTeacherId, pay_share_pct: 100 }]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, assignedTeacherId]);

  const totalPct = slots.reduce((s, x) => s + x.pay_share_pct, 0);
  const usedIds = new Set(slots.map((s) => s.teacher_id));

  function addSlot() {
    // Chọn GV chưa dùng đầu tiên.
    const next = teachers.find((t) => !usedIds.has(t.id));
    if (!next) return;
    setSlots([...slots, { teacher_id: next.id, pay_share_pct: 0 }]);
  }

  function removeSlot(idx: number) {
    setSlots(slots.filter((_, i) => i !== idx));
  }

  function updateSlot(idx: number, patch: Partial<Slot>) {
    setSlots(slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function distributeEqually() {
    if (slots.length === 0) return;
    const each = Math.floor(100 / slots.length);
    const remainder = 100 - each * slots.length;
    setSlots(
      slots.map((s, i) => ({
        ...s,
        pay_share_pct: each + (i === 0 ? remainder : 0),
      })),
    );
  }

  async function handleSave() {
    setError(null);
    if (totalPct !== 100) {
      setError("Tổng tỷ lệ chia lương phải = 100%.");
      return;
    }
    setSaving(true);
    const r = await setSessionTeachers({
      session_id: sessionId,
      teachers: slots,
    });
    setSaving(false);
    if (r.success) {
      onClose();
    } else {
      setError(r.error);
    }
  }

  async function handleResetSolo() {
    if (!confirm("Trở về dạng solo (xoá cấu hình co-teaching)?")) return;
    setSaving(true);
    const r = await clearSessionTeachers(sessionId);
    setSaving(false);
    if (r.success) onClose();
    else setError(r.error);
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
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">
              Co-teaching — chia lương buổi học
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

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Mỗi giáo viên nhận lương theo tỷ lệ. Tổng phải = 100%.
          </p>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Tỷ lệ chỉ áp cho phần lương theo giờ (HOURLY) và theo buổi
              (PER_SESSION). Lương cứng tháng (FIXED_MONTHLY) hoặc phần fixed
              của HYBRID KHÔNG chia — toàn bộ phần đó cộng đủ một lần cho
              giáo viên có rule, không phụ thuộc tỷ lệ.
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : (
            <>
              <ul className="space-y-2">
                {slots.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/40 p-2"
                  >
                    <select
                      value={s.teacher_id}
                      onChange={(e) => updateSlot(idx, { teacher_id: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                      {teachers.map((t) => (
                        <option
                          key={t.id}
                          value={t.id}
                          disabled={t.id !== s.teacher_id && usedIds.has(t.id)}
                        >
                          {t.display_name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={s.pay_share_pct}
                        onChange={(e) =>
                          updateSlot(idx, { pay_share_pct: Number(e.target.value) || 0 })
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 outline-none focus:border-slate-400"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      disabled={slots.length <= 1}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                      title="Xoá dòng"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addSlot}
                    disabled={slots.length >= teachers.length}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm GV
                  </button>
                  <button
                    type="button"
                    onClick={distributeEqually}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    Chia đều
                  </button>
                </div>
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    totalPct === 100
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  Tổng: {totalPct}%{totalPct !== 100 && " (cần = 100%)"}
                </span>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={handleResetSolo}
            disabled={saving}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
          >
            Trở về solo
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || totalPct !== 100 || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

