"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2, UserCheck } from "lucide-react";

import {
  createSubstitution,
  deleteSubstitution,
  listAbsentTeacherSlotsForDate,
  listSubstitutionsForDate,
  suggestSubstitutes,
  type AbsentTeacherSlot,
  type SubstituteCandidate,
} from "@/modules/school-payroll/actions";
import type { SubstitutionRow } from "@/modules/school-payroll/types";
import type { TenantTeacherRow } from "@/types/database";

interface Props {
  schoolYearId: string;
  schoolYearLabel: string;
  teachers: TenantTeacherRow[];
}

const REASONS = [
  { value: "ÔM", label: "Ốm" },
  { value: "PHÉP", label: "Phép" },
  { value: "KHÔNG_PHÉP", label: "Không phép" },
  { value: "CÔNG_TÁC", label: "Công tác" },
  { value: "BỒI_DƯỠNG", label: "Bồi dưỡng" },
  { value: "KHÁC", label: "Khác" },
] as const;

export default function SubstitutesClient({
  schoolYearId,
  schoolYearLabel,
  teachers,
}: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [absentTeacherId, setAbsentTeacherId] = useState<string>("");
  const [slots, setSlots] = useState<AbsentTeacherSlot[]>([]);
  const [existingSubs, setExistingSubs] = useState<SubstitutionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] =
    useState<(typeof REASONS)[number]["value"]>("ÔM");
  const [paySubstitute, setPaySubstitute] = useState(true);
  const [deductFlag, setDeductFlag] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<AbsentTeacherSlot | null>(null);
  const [pending, startTransition] = useTransition();
  const [refresh, setRefresh] = useState(0);

  // Tải slot khi đổi (teacher, date)
  useEffect(() => {
    if (!absentTeacherId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listAbsentTeacherSlotsForDate(absentTeacherId, date),
      listSubstitutionsForDate(date),
    ]).then(([slotsRes, subsRes]) => {
      if (cancelled) return;
      if (slotsRes.success) setSlots(slotsRes.data);
      if (subsRes.success) setExistingSubs(subsRes.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [absentTeacherId, date, refresh]);

  function openPicker(slot: AbsentTeacherSlot) {
    setPickerOpen(slot);
  }

  function handleDeleteSub(subId: string) {
    if (!confirm("Xoá bản ghi dạy thay này?")) return;
    startTransition(async () => {
      await deleteSubstitution(subId);
      setRefresh((k) => k + 1);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr]">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Giáo viên nghỉ
          </label>
          <select
            value={absentTeacherId}
            onChange={(e) => setAbsentTeacherId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          >
            <option value="">— Chọn giáo viên —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Ngày nghỉ
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* Lý do + flags chung cho ngày */}
      {absentTeacherId && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Lý do (áp cho mọi tiết dạy thay tạo hôm nay)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={paySubstitute}
              onChange={(e) => setPaySubstitute(e.target.checked)}
            />
            Trả lương GV thay
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={deductFlag}
              onChange={(e) => setDeductFlag(e.target.checked)}
            />
            Đánh dấu trừ GV gốc
          </label>
        </div>
      )}

      {/* Slot list */}
      {!absentTeacherId ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-12 text-center">
          <p className="text-sm text-slate-600">
            Chọn giáo viên + ngày để bắt đầu phân công.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Đang tải tiết dạy…</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Giáo viên này không có tiết dạy trong ngày {date}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Tiết</th>
                <th className="px-3 py-2.5 text-left">Lớp · Môn</th>
                <th className="px-3 py-2.5 text-left">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slots.map((s) => {
                const existing = existingSubs.find(
                  (es) => es.timetable_slot_id === s.slot_id,
                );
                const substTeacher = existing
                  ? teachers.find((t) => t.id === existing.substitute_teacher_id)
                  : null;
                return (
                  <tr key={s.slot_id}>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">
                      {s.shift === "SANG" ? "Sáng" : "Chiều"} · T{s.period_index}
                    </td>
                    <td className="px-3 py-2.5 text-slate-900">
                      <span className="font-semibold">{s.class_name}</span>
                      <span className="ml-1 text-slate-500">{s.subject_short}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {existing ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <UserCheck className="h-3 w-3" />
                          {substTeacher?.display_name ?? "?"}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">
                          Chưa phân công
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {existing ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSub(existing.id)}
                          disabled={pending}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPicker(s)}
                          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                        >
                          Chọn GV thay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer hint */}
      <p className="text-xs leading-relaxed text-slate-500">
        Năm học: <strong>{schoolYearLabel}</strong>. Các bản ghi dạy thay sẽ
        tính vào lương thừa giờ cuối năm (xem ở Lương trường học).
      </p>

      {/* Picker modal */}
      {pickerOpen && absentTeacherId && (
        <SubstitutePickerModal
          slot={pickerOpen}
          date={date}
          schoolYearId={schoolYearId}
          originalTeacherId={absentTeacherId}
          reason={reason}
          paySubstitute={paySubstitute}
          deductFlag={deductFlag}
          onClose={() => setPickerOpen(null)}
          onSaved={() => {
            setPickerOpen(null);
            setRefresh((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ── Picker modal ────────────────────────────────────────────────────────

function SubstitutePickerModal({
  slot,
  date,
  schoolYearId,
  originalTeacherId,
  reason,
  paySubstitute,
  deductFlag,
  onClose,
  onSaved,
}: {
  slot: AbsentTeacherSlot;
  date: string;
  schoolYearId: string;
  originalTeacherId: string;
  reason: "ÔM" | "PHÉP" | "KHÔNG_PHÉP" | "CÔNG_TÁC" | "BỒI_DƯỠNG" | "KHÁC";
  paySubstitute: boolean;
  deductFlag: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [candidates, setCandidates] = useState<SubstituteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    suggestSubstitutes({
      date,
      timetable_slot_id: slot.slot_id,
    }).then((r) => {
      if (r.success) setCandidates(r.data);
      setLoading(false);
    });
  }, [slot.slot_id, date]);

  async function pickTeacher(t: SubstituteCandidate) {
    setSaving(t.teacher_id);
    const r = await createSubstitution({
      school_year_id: schoolYearId,
      timetable_slot_id: slot.slot_id,
      session_id: null,
      date,
      period_index: slot.period_index,
      shift: slot.shift,
      original_teacher_id: originalTeacherId,
      substitute_teacher_id: t.teacher_id,
      reason,
      reason_note: null,
      pay_substitute: paySubstitute,
      deduct_original_flag: deductFlag,
      deduct_original_note: null,
    });
    setSaving(null);
    if (r.success) onSaved();
    else alert(r.error);
  }

  const free = candidates.filter((c) => c.is_free);
  const busy = candidates.filter((c) => !c.is_free);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-bold text-slate-900">
            Chọn giáo viên thay
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {slot.shift === "SANG" ? "Sáng" : "Chiều"} T{slot.period_index} ·{" "}
            {slot.class_name} · {slot.subject_short}
          </p>
        </div>

        <div className="px-5 py-3">
          {loading ? (
            <p className="text-sm text-slate-500">Đang tính điểm gợi ý…</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Đang trống tiết — gợi ý theo điểm
              </p>
              <ul className="mt-2 space-y-1.5">
                {free.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                    Không có GV nào đang trống tiết này.
                  </li>
                ) : (
                  free.map((c) => (
                    <CandidateRow
                      key={c.teacher_id}
                      candidate={c}
                      saving={saving === c.teacher_id}
                      onClick={() => pickTeacher(c)}
                    />
                  ))
                )}
              </ul>

              {busy.length > 0 && (
                <>
                  <div className="mt-4 flex items-center gap-1.5 text-xs uppercase tracking-wide text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Đang bận tiết này — chỉ chọn nếu thật sự cần
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {busy.map((c) => (
                      <CandidateRow
                        key={c.teacher_id}
                        candidate={c}
                        saving={saving === c.teacher_id}
                        onClick={() => pickTeacher(c)}
                        warning
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  saving,
  warning,
  onClick,
}: {
  candidate: SubstituteCandidate;
  saving: boolean;
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
        warning
          ? "border-amber-200 bg-amber-50/30"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {candidate.display_name}
          </p>
          <span className="font-mono text-xs text-slate-500">
            +{candidate.score}đ
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10.5px]">
          {candidate.same_subject && (
            <Tag color="indigo">cùng môn +5</Tag>
          )}
          {candidate.same_grade && <Tag color="cyan">cùng khối +3</Tag>}
          {candidate.is_homeroom && (
            <Tag color="emerald">GVCN lớp này +5</Tag>
          )}
          {candidate.recent_substitutions > 0 && (
            <Tag color="amber">
              đã thay {candidate.recent_substitutions} lần 30 ngày qua
            </Tag>
          )}
          {candidate.busy_with && (
            <Tag color="rose">
              đang dạy {candidate.busy_with.class_name} ·{" "}
              {candidate.busy_with.subject_short}
            </Tag>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-50 ${
          warning
            ? "border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
            : "bg-slate-900 text-white hover:opacity-90"
        }`}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          "Chọn"
        )}
      </button>
    </li>
  );
}

function Tag({
  color,
  children,
}: {
  color: "indigo" | "cyan" | "emerald" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${colors[color]}`}
    >
      {children}
    </span>
  );
}
