"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { listClasses, type ClassRow } from "@/modules/classes/actions";
import { enrollStudent } from "@/modules/students/actions";
import type { StudentRow } from "@/modules/students/types";

interface Props {
  student: StudentRow;
  onClose: () => void;
  onDone: () => void;
}

export default function EnrollClassModal({ student, onClose, onDone }: Props) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classId, setClassId] = useState("");
  const [enrolledAt, setEnrolledAt] = useState(new Date().toISOString().slice(0, 10));
  const [tuition, setTuition] = useState("");
  const [cycle, setCycle] = useState<"MONTHLY" | "PER_SESSION" | "ANNUAL" | "ONE_TIME">("MONTHLY");
  const [day, setDay] = useState("5");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listClasses({ withStudentCount: false }).then((r) => {
      if (r.success) setClasses(r.data as ClassRow[]);
      setLoadingClasses(false);
    });
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!classId) {
      setError("Chọn lớp để đăng ký.");
      return;
    }
    startTransition(async () => {
      const r = await enrollStudent({
        student_id: student.id,
        class_id: classId,
        enrolled_at: enrolledAt,
        tuition_amount_vnd: tuition ? Number(tuition.replace(/\D/g, "")) : null,
        billing_cycle: cycle,
        payment_day: cycle === "MONTHLY" ? Number(day) || null : null,
        note: note.trim() || null,
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            Đăng ký lớp cho {student.display_name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 font-mono text-xs text-slate-500">{student.student_code}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Lớp *</Label>
            {loadingClasses ? (
              <p className="text-xs text-slate-500">Đang tải danh sách lớp…</p>
            ) : classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Chưa có lớp nào. Hãy tạo lớp tại{" "}
                <Link href="/dashboard/classes" className="font-semibold underline">
                  Quản lý lớp
                </Link>{" "}
                trước.
              </div>
            ) : (
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">— Chọn lớp —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.year_label ? ` (${c.year_label})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Ngày đăng ký *</Label>
              <input
                type="date"
                required
                value={enrolledAt}
                onChange={(e) => setEnrolledAt(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <Label>Học phí (đ)</Label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="vd. 1.500.000"
                value={tuition}
                onChange={(e) => setTuition(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Chu kỳ đóng</Label>
              <select
                value={cycle}
                onChange={(e) =>
                  setCycle(e.target.value as "MONTHLY" | "PER_SESSION" | "ANNUAL" | "ONE_TIME")
                }
                className={inputCls}
              >
                <option value="MONTHLY">Theo tháng</option>
                <option value="PER_SESSION">Theo buổi</option>
                <option value="ANNUAL">Theo năm</option>
                <option value="ONE_TIME">Đóng 1 lần</option>
              </select>
            </div>
            {cycle === "MONTHLY" && (
              <div className="space-y-1">
                <Label>Ngày đóng trong tháng</Label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Ghi chú</Label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
              placeholder="vd. Học buổi tối, nghỉ thứ 7…"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending || classes.length === 0}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang đăng ký…" : "Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}
