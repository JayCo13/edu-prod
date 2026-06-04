"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createStudent,
  deleteStudent,
  listStudents,
  updateStudent,
  type StudentInput,
} from "@/modules/students/actions";
import {
  GENDER_LABEL,
  type StudentGender,
  type StudentRow,
} from "@/modules/students/types";

import StudentFormModal from "./StudentFormModal";
import StudentImportModal from "./StudentImportModal";
import EnrollClassModal from "./EnrollClassModal";

export default function StudentsClient() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StudentRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [enrollFor, setEnrollFor] = useState<StudentRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listStudents().then((r) => {
      if (cancelled) return;
      if (r.success) setRows(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = removeDiacritics(search.toLowerCase());
    return rows.filter((s) => {
      const haystack = removeDiacritics(
        `${s.display_name} ${s.student_code} ${s.parent_name ?? ""} ${s.parent_phone ?? ""} ${s.phone ?? ""}`.toLowerCase(),
      );
      return haystack.includes(q);
    });
  }, [rows, search]);

  const confirm = useConfirm();

  function handleSave(input: StudentInput) {
    const current = editing;
    if (!current) return;
    startTransition(async () => {
      if (typeof current === "string") {
        const r = await createStudent(input);
        if (r.success) {
          setRows((xs) => [r.data, ...xs].sort((a, b) => a.display_name.localeCompare(b.display_name)));
          setEditing(null);
          toast.success(`Đã thêm học sinh ${r.data.display_name}.`);
        } else toast.error(r.error);
      } else {
        const r = await updateStudent(current.id, input);
        if (r.success) {
          setRows((xs) => xs.map((x) => (x.id === current.id ? r.data : x)));
          setEditing(null);
          toast.success("Đã cập nhật học sinh.");
        } else toast.error(r.error);
      }
    });
  }

  async function handleDelete(row: StudentRow) {
    const ok = await confirm({
      title: `Xoá học sinh ${row.display_name}?`,
      description:
        "Nếu HS đã có lịch sử lớp/học phí thì hệ thống sẽ chỉ đặt ngừng kích hoạt thay vì xoá cứng.",
      variant: "danger",
      confirmLabel: "Xoá",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteStudent(row.id);
      if (r.success) {
        setRows((xs) => xs.filter((x) => x.id !== row.id));
        toast.success(`Đã xoá / ngừng kích hoạt ${row.display_name}.`);
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã HS, SĐT phụ huynh…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Import Excel
        </button>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Thêm học sinh
        </button>
      </div>

      {/* Stat */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-600">
        <Users className="mr-1.5 inline h-3.5 w-3.5" />
        {filtered.length} học sinh
        {search && rows.length !== filtered.length && (
          <span className="ml-1 text-slate-400">(lọc từ {rows.length})</span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
          Đang tải…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            {search ? "Không tìm thấy học sinh phù hợp." : "Chưa có học sinh nào."}
          </p>
          {!search && (
            <p className="mt-1 text-xs text-slate-500">
              Bấm <strong>Thêm học sinh</strong> hoặc <strong>Import Excel</strong> để bắt đầu.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Mã HS</th>
                <th className="px-3 py-2.5 text-left">Họ và tên</th>
                <th className="px-3 py-2.5 text-left">Ngày sinh</th>
                <th className="px-3 py-2.5 text-left">Giới tính</th>
                <th className="px-3 py-2.5 text-left">Phụ huynh</th>
                <th className="px-3 py-2.5 text-left">SĐT phụ huynh</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600">
                    {s.student_code}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {s.display_name}
                    {!s.is_active && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold uppercase text-slate-600">
                        ngừng
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDob(s.dob)}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {s.gender ? GENDER_LABEL[s.gender] : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{s.parent_name ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">
                    {s.parent_phone ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEnrollFor(s)}
                        title="Đăng ký lớp"
                        className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <StudentFormModal
          initial={typeof editing === "string" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSave}
          pending={pending}
        />
      )}
      {importing && (
        <StudentImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            setReload((k) => k + 1);
          }}
        />
      )}
      {enrollFor && (
        <EnrollClassModal
          student={enrollFor}
          onClose={() => setEnrollFor(null)}
          onDone={() => setEnrollFor(null)}
        />
      )}
    </div>
  );
}

function formatDob(dob: string | null): string {
  if (!dob) return "—";
  const [y, m, d] = dob.split("-");
  return `${d}/${m}/${y}`;
}

// Diacritic-insensitive search.
function removeDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// re-export so prop typing works trivially in child if needed
export type { StudentGender };
