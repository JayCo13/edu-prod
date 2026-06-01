"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { GraduationCap, Pencil, Plus, Trash2, Users, X } from "lucide-react";

import {
  createClass,
  deleteClass,
  listClasses,
  updateClass,
  type ClassInput,
  type ClassRow,
  type ClassWithCount,
} from "@/modules/classes/actions";

export default function ClassesClient() {
  const [rows, setRows] = useState<ClassWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClassRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listClasses({ withStudentCount: true, includeInactive: true }).then((r) => {
      if (cancelled) return;
      if (r.success) setRows(r.data as ClassWithCount[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function handleSave(input: ClassInput) {
    const current = editing;
    if (!current) return;
    startTransition(async () => {
      if (typeof current === "string") {
        const r = await createClass(input);
        if (r.success) {
          setRows((xs) => [{ ...(r.data as ClassRow), active_student_count: 0 }, ...xs]);
          setEditing(null);
        } else alert(r.error);
      } else {
        const r = await updateClass(current.id, input);
        if (r.success) {
          setRows((xs) =>
            xs.map((x) =>
              x.id === current.id ? { ...(r.data as ClassRow), active_student_count: x.active_student_count } : x,
            ),
          );
          setEditing(null);
        } else alert(r.error);
      }
    });
  }

  function handleDelete(row: ClassRow) {
    if (!confirm(`Xoá lớp "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteClass(row.id);
      if (r.success) {
        setReload((k) => k + 1);
      } else alert(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Tạo lớp
        </button>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Chưa có lớp nào.</p>
          <p className="mt-1 text-xs text-slate-500">
            Bấm <strong>Tạo lớp</strong> để bắt đầu.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                !c.is_active ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-slate-900">{c.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.grade_level ? `Khối ${c.grade_level}` : "—"}
                    {c.year_label && ` · ${c.year_label}`}
                  </p>
                </div>
                {!c.is_active && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    ngừng
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
                <Users className="h-3.5 w-3.5" />
                {c.active_student_count} học sinh
              </p>
              <div className="mt-3 flex gap-1.5">
                <Link
                  href={`/dashboard/classes/${c.id}`}
                  className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Xem chi tiết
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ClassFormModal
          initial={typeof editing === "string" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSave}
          pending={pending}
        />
      )}
    </div>
  );
}

function ClassFormModal({
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  initial: ClassRow | null;
  onClose: () => void;
  onSubmit: (input: ClassInput) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [grade, setGrade] = useState(initial?.grade_level?.toString() ?? "");
  const [yearLabel, setYearLabel] = useState(initial?.year_label ?? `${new Date().getFullYear()}`);
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            {initial ? `Sửa: ${initial.name}` : "Tạo lớp mới"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: name.trim(),
              grade_level: grade ? Number(grade) : null,
              year_label: yearLabel.trim(),
              is_active: active,
            });
          }}
          className="mt-4 space-y-3"
        >
          <div className="space-y-1">
            <Label>Tên lớp *</Label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="vd. Toán 8 (Tối T2-T4)"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Khối lớp (1-12, có thể bỏ trống)</Label>
              <input
                type="number"
                min={1}
                max={12}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className={inputCls}
                placeholder="vd. 8"
              />
            </div>
            <div className="space-y-1">
              <Label>Khoá / Năm</Label>
              <input
                value={yearLabel}
                onChange={(e) => setYearLabel(e.target.value)}
                className={inputCls}
                placeholder="vd. 2025-2026, Hè 2026"
              />
            </div>
          </div>
          {initial && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              Đang hoạt động
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu"}
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
