"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Pagination, usePagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [gradeFilter, setGradeFilter] = useState<"all" | number | "none">("all");

  const filtered = useMemo(() => {
    let xs = rows;
    if (statusFilter === "active") xs = xs.filter((c) => c.is_active);
    else if (statusFilter === "inactive") xs = xs.filter((c) => !c.is_active);
    if (gradeFilter === "none") xs = xs.filter((c) => c.grade_level == null);
    else if (typeof gradeFilter === "number")
      xs = xs.filter((c) => c.grade_level === gradeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.year_label ?? "").toLowerCase().includes(q),
      );
    }
    return xs;
  }, [rows, statusFilter, gradeFilter, search]);

  const { page, pageSize, paged, total, setPage, setPageSize } = usePagination(
    filtered,
    12,
  );

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

  const confirm = useConfirm();

  function handleSave(input: ClassInput) {
    const current = editing;
    if (!current) return;
    startTransition(async () => {
      if (typeof current === "string") {
        const r = await createClass(input);
        if (r.success) {
          setRows((xs) => [{ ...(r.data as ClassRow), active_student_count: 0 }, ...xs]);
          setEditing(null);
          toast.success(`Đã tạo lớp "${(r.data as ClassRow).name}".`);
        } else toast.error(r.error);
      } else {
        const r = await updateClass(current.id, input);
        if (r.success) {
          setRows((xs) =>
            xs.map((x) =>
              x.id === current.id ? { ...(r.data as ClassRow), active_student_count: x.active_student_count } : x,
            ),
          );
          setEditing(null);
          toast.success("Đã cập nhật lớp.");
        } else toast.error(r.error);
      }
    });
  }

  async function handleDelete(row: ClassRow) {
    const ok = await confirm({
      title: `Xoá lớp "${row.name}"?`,
      description:
        "Nếu lớp đang có HS thì hệ thống sẽ chỉ đặt thành ngừng hoạt động. Hành động này không thể hoàn tác.",
      variant: "danger",
      confirmLabel: "Xoá",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteClass(row.id);
      if (r.success) {
        setReload((k) => k + 1);
        toast.success(`Đã xoá lớp "${row.name}".`);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên lớp, khoá…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Tạo lớp
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500">Trạng thái:</span>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
          {(
            [
              ["active", "Hoạt động"],
              ["inactive", "Đã ngừng"],
              ["all", "Tất cả"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatusFilter(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                statusFilter === v
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-2 font-semibold text-slate-500">Khối:</span>
        <select
          value={gradeFilter === "all" || gradeFilter === "none" ? gradeFilter : String(gradeFilter)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "all" || v === "none") setGradeFilter(v);
            else setGradeFilter(Number(v));
          }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
        >
          <option value="all">Tất cả</option>
          <option value="none">Không phân khối</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
            <option key={n} value={n}>
              Khối {n}
            </option>
          ))}
        </select>
        {(statusFilter !== "active" || gradeFilter !== "all" || search) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("active");
              setGradeFilter("all");
              setSearch("");
            }}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Xoá bộ lọc
          </button>
        )}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            {rows.length === 0
              ? "Chưa có lớp nào."
              : "Không tìm thấy lớp phù hợp với bộ lọc."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {rows.length === 0 ? (
              <>
                Bấm <strong>Tạo lớp</strong> để bắt đầu.
              </>
            ) : (
              <>Đổi bộ lọc hoặc xoá lọc để xem tất cả.</>
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((c) => (
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

      {!loading && filtered.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[12, 24, 48, 96]}
          unit="lớp"
        />
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
  const [yearLabel, setYearLabel] = useState(initial?.year_label ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initial ? "Sửa lớp" : "Tạo lớp mới"}
            </h3>
            {initial && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{initial.name}</p>
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
        >
          {/* Body */}
          <div className="space-y-4 px-6 py-5">
            <Field
              label="Tên lớp"
              required
              hint="Đặt tên dễ nhận diện, vd. có cả môn + lịch"
            >
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Toán 8 — Tối T2/T4"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Khối lớp" hint="1–12, tuỳ chọn">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className={inputCls}
                  placeholder="8"
                />
              </Field>
              <Field
                label="Khoá / Năm"
                hint={`vd. ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}
              >
                <input
                  value={yearLabel}
                  onChange={(e) => setYearLabel(e.target.value)}
                  className={inputCls}
                  placeholder="2025-2026"
                />
              </Field>
            </div>

            {initial && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                <span className="flex-1">Đang hoạt động</span>
                <span className="text-xs text-slate-400">
                  {active ? "Hiển thị trong danh sách" : "Ẩn khỏi danh sách"}
                </span>
              </label>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-slate-100 bg-slate-50/40 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

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
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium text-slate-800">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      </div>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
