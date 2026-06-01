"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Search, UserPlus, Users, X } from "lucide-react";

import { bulkEnrollStudents, listStudents } from "@/modules/students/actions";
import type { StudentRow } from "@/modules/students/types";

interface Props {
  classId: string;
  className: string;
  existingStudentIds: Set<string>; // HS đang ACTIVE trong lớp → ẩn / disable
  onClose: () => void;
  onDone: (added: number) => void;
}

type BillingCycle = "MONTHLY" | "PER_SESSION" | "ANNUAL" | "ONE_TIME";

export default function AddStudentsModal({
  classId,
  className,
  existingStudentIds,
  onClose,
  onDone,
}: Props) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tuition, setTuition] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [day, setDay] = useState("5");
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listStudents().then((r) => {
      if (cancelled) return;
      if (r.success) {
        // Loại HS đã trong lớp
        setStudents(r.data.filter((s) => !existingStudentIds.has(s.id)));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [existingStudentIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = removeDiacritics(search.toLowerCase());
    return students.filter((s) => {
      const hay = removeDiacritics(
        `${s.display_name} ${s.student_code} ${s.parent_name ?? ""} ${s.parent_phone ?? ""}`.toLowerCase(),
      );
      return hay.includes(q);
    });
  }, [students, search]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAllVisible() {
    const next = new Set(selected);
    if (allVisibleSelected) {
      filtered.forEach((s) => next.delete(s.id));
    } else {
      filtered.forEach((s) => next.add(s.id));
    }
    setSelected(next);
  }

  function handleSubmit() {
    setError(null);
    if (selected.size === 0) {
      setError("Chọn ít nhất 1 học sinh để thêm vào lớp.");
      return;
    }
    startTransition(async () => {
      const r = await bulkEnrollStudents({
        class_id: classId,
        student_ids: [...selected],
        enrolled_at: enrolledAt,
        tuition_amount_vnd: tuition ? Number(tuition.replace(/\D/g, "")) : null,
        billing_cycle: cycle,
        payment_day: cycle === "MONTHLY" ? Number(day) || null : null,
      });
      if (r.success) {
        onDone(r.data.enrolled);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserPlus className="h-4 w-4 text-indigo-600" />
              Thêm học sinh vào lớp
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">{className}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bulk fields áp dụng cho toàn bộ HS chọn */}
        <div className="border-b border-slate-100 bg-slate-50/40 px-6 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Áp dụng cho tất cả HS chọn — có thể chỉnh từng HS sau
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Ngày vào" required compact>
              <input
                type="date"
                required
                value={enrolledAt}
                onChange={(e) => setEnrolledAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Học phí (đ)" compact>
              <input
                inputMode="numeric"
                value={tuition}
                onChange={(e) => setTuition(e.target.value)}
                placeholder="1.500.000"
                className={inputCls}
              />
            </Field>
            <Field label="Chu kỳ" compact>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value as BillingCycle)}
                className={inputCls}
              >
                <option value="MONTHLY">Theo tháng</option>
                <option value="PER_SESSION">Theo buổi</option>
                <option value="ANNUAL">Theo năm</option>
                <option value="ONE_TIME">Đóng 1 lần</option>
              </select>
            </Field>
            <Field label="Ngày đóng" compact>
              <input
                type="number"
                min={1}
                max={31}
                disabled={cycle !== "MONTHLY"}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
              />
            </Field>
          </div>
        </div>

        {/* Search + Select all */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, mã HS, SĐT phụ huynh…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {allVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Đang tải…</p>
          ) : students.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                Mọi học sinh đã có trong lớp này.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Hoặc bạn chưa có học sinh nào — vào{" "}
                <a href="/dashboard/students" className="font-semibold text-slate-700 underline">
                  Quản lý HS
                </a>{" "}
                để thêm.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Không tìm thấy học sinh phù hợp.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const isSel = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 ${
                        isSel ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          isSel
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSel && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(s.id)}
                        className="sr-only"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">
                          {s.display_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-mono tabular-nums">{s.student_code}</span>
                          {s.parent_name && <span>PH: {s.parent_name}</span>}
                          {s.parent_phone && (
                            <span className="font-mono tabular-nums">{s.parent_phone}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p className="border-t border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-6 py-3.5">
          <p className="text-sm text-slate-600">
            Đã chọn{" "}
            <strong className="text-slate-900">{selected.size}</strong> /{" "}
            {students.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || selected.size === 0}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? "Đang thêm…"
                : selected.size > 0
                  ? `Thêm ${selected.size} học sinh`
                  : "Thêm vào lớp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

function Field({
  label,
  required,
  compact,
  children,
}: {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function removeDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}
