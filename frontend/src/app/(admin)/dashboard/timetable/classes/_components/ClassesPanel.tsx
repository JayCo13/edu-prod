"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Replace,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  createClass,
  deleteClass,
  seedGradeClasses,
  updateClass,
} from "@/modules/timetable/actions";
import type { ClassRow } from "@/modules/timetable/types";
import type { TenantTeacherRow } from "@/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination, usePagination } from "@/components/ui/pagination";

/** Strip Vietnamese diacritics so "nguyen" matches "Nguyễn" (CLAUDE.md §8.3). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

interface Props {
  initialClasses: ClassRow[];
  teachers: TenantTeacherRow[];
}

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEAR = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`;

// Class-name format options shown in the bulk-seed UI. Keep this in sync
// with the same enum on the server action (actions.ts → buildClassName).
// Sample shows how the first 3 classes of grade 6 will be named.
type ClassNameFormat = "LETTER_NUM" | "LETTER" | "DOT" | "SLASH";
const FORMAT_OPTIONS: readonly {
  value: ClassNameFormat;
  label: string;
  sample: string;
  hint: string;
}[] = [
  {
    value: "LETTER_NUM",
    label: "6A1, 6A2, ...",
    sample: "6A1 · 6A2 · 6A3",
    hint: "Phổ biến nhất ở THCS / THPT lớn",
  },
  {
    value: "LETTER",
    label: "6A, 6B, 6C, ...",
    sample: "6A · 6B · 6C",
    hint: "Trường nhỏ, kiểu cũ (tối đa 26 lớp)",
  },
  {
    value: "DOT",
    label: "6.1, 6.2, ...",
    sample: "6.1 · 6.2 · 6.3",
    hint: "Trường theo chương trình mới (MOET)",
  },
  {
    value: "SLASH",
    label: "6/1, 6/2, ...",
    sample: "6/1 · 6/2 · 6/3",
    hint: "Một số trường miền Nam",
  },
];

// Inline helper for the live preview — server action has its own copy that's
// authoritative at insert time.
function previewClassName(
  grade: number,
  index: number,
  format: ClassNameFormat,
  letter = "A",
): string {
  switch (format) {
    case "LETTER_NUM":
      return `${grade}${letter}${index}`;
    case "LETTER":
      return `${grade}${String.fromCharCode(64 + index)}`;
    case "DOT":
      return `${grade}.${index}`;
    case "SLASH":
      return `${grade}/${index}`;
  }
}

export default function ClassesPanel({ initialClasses, teachers }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [classes, setClasses] = useState(initialClasses);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [homeroom, setHomeroom] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Collapse state for the 2 main panels ──────────────────────────────
  // Auto-open the create panel when there are zero classes (first run).
  const [createOpen, setCreateOpen] = useState(initialClasses.length === 0);
  const [filterOpen, setFilterOpen] = useState(false);

  // Create mode: single class vs bulk-by-grade.
  const [createMode, setCreateMode] = useState<"single" | "bulk">("bulk");

  // ── Filters (advanced) ────────────────────────────────────────────────
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [homeroomFilter, setHomeroomFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [classQuery, setClassQuery] = useState("");

  const gradesInUse = useMemo(() => {
    const set = new Set<number>();
    for (const c of classes) {
      if (c.grade_level != null) set.add(c.grade_level);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [classes]);

  const yearsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const c of classes) {
      if (c.year_label) set.add(c.year_label);
    }
    return Array.from(set).sort().reverse();
  }, [classes]);

  // Filter + natural sort. localeCompare with numeric:true treats embedded
  // numbers correctly so 6A1 → 6A2 → 6A10 → 6A12 lines up the way teachers
  // expect (not 6A1, 6A10, 6A11, 6A12, 6A2 alphabetically).
  const displayedClasses = useMemo(() => {
    const q = normalize(classQuery.trim());
    const list = classes.filter((c) => {
      if (gradeFilter !== "all" && c.grade_level !== gradeFilter) return false;
      if (yearFilter !== "all" && (c.year_label ?? "") !== yearFilter)
        return false;
      if (homeroomFilter === "assigned" && !c.homeroom_teacher_id)
        return false;
      if (homeroomFilter === "unassigned" && c.homeroom_teacher_id)
        return false;
      if (q && !normalize(c.name).includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const ga = a.grade_level ?? Number.POSITIVE_INFINITY;
      const gb = b.grade_level ?? Number.POSITIVE_INFINITY;
      if (ga !== gb) return ga - gb;
      return a.name.localeCompare(b.name, "vi", { numeric: true });
    });
  }, [classes, gradeFilter, yearFilter, homeroomFilter, classQuery]);

  const hasActiveFilter =
    gradeFilter !== "all" ||
    yearFilter !== "all" ||
    homeroomFilter !== "all" ||
    classQuery.trim() !== "";

  // Pagination over the filtered, sorted list. select-all + bulk actions
  // still operate on the FULL `displayedClasses` (filter-scope), not just
  // the visible page — admins expect "select all matching filter".
  const pager = usePagination(displayedClasses, 30);
  const activeFilterCount =
    (gradeFilter !== "all" ? 1 : 0) +
    (yearFilter !== "all" ? 1 : 0) +
    (homeroomFilter !== "all" ? 1 : 0) +
    (classQuery.trim() !== "" ? 1 : 0);

  // ── Bulk selection ─────────────────────────────────────────────────────
  // Tracks which class IDs are checked. The select-all header toggles all
  // rows currently visible in the filtered list (not the entire dataset).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // Which bulk action modal is open. null = none.
  const [bulkAction, setBulkAction] = useState<
    null | "year" | "rename"
  >(null);
  const [bulkSavePending, setBulkSavePending] = useState(false);
  const [bulkYear, setBulkYear] = useState("");
  const [bulkFind, setBulkFind] = useState("");
  const [bulkReplace, setBulkReplace] = useState("");

  function openBulkAction(kind: "year" | "rename") {
    setBulkYear("");
    setBulkFind("");
    setBulkReplace("");
    setBulkAction(kind);
  }
  function closeBulkAction() {
    if (bulkSavePending) return;
    setBulkAction(null);
  }

  // ── Edit modal state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHomeroom, setEditHomeroom] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(c: ClassRow) {
    setEditing(c);
    setEditName(c.name);
    setEditYear(c.year_label ?? "");
    setEditHomeroom(c.homeroom_teacher_id ?? null);
  }
  function closeEdit() {
    if (savingEdit) return;
    setEditing(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Tên lớp không được để trống.");
      return;
    }
    setSavingEdit(true);
    const r = await updateClass(editing.id, {
      name: trimmed,
      year_label: editYear.trim(),
      homeroom_teacher_id: editHomeroom,
    });
    setSavingEdit(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    setClasses((prev) =>
      prev.map((x) => (x.id === editing.id ? (r.data as ClassRow) : x)),
    );
    toast.success("Đã lưu thay đổi.");
    setEditing(null);
    router.refresh();
  }

  // Compute the selected classes (in displayed order) and a preview of how
  // the rename pattern transforms each name. Empty find string = no-op.
  const selectedClasses = useMemo(
    () => classes.filter((c) => selected.has(c.id)),
    [classes, selected],
  );
  const renamePreview = useMemo(() => {
    const find = bulkFind;
    const replace = bulkReplace;
    if (!find) return selectedClasses.map((c) => ({ id: c.id, from: c.name, to: c.name, changed: false }));
    return selectedClasses.map((c) => {
      const to = c.name.replace(find, replace);
      return { id: c.id, from: c.name, to, changed: to !== c.name };
    });
  }, [selectedClasses, bulkFind, bulkReplace]);

  async function runBulkUpdate(
    patches: { id: string; name?: string; year_label?: string }[],
  ) {
    setBulkSavePending(true);
    const results = await Promise.all(
      patches.map((p) =>
        updateClass(p.id, {
          ...(p.name !== undefined ? { name: p.name } : {}),
          ...(p.year_label !== undefined ? { year_label: p.year_label } : {}),
        }),
      ),
    );
    setBulkSavePending(false);
    const updated: ClassRow[] = [];
    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.success && r.data) updated.push(r.data as ClassRow);
      else if (!r.success) {
        const original = classes.find((c) => c.id === patches[i].id);
        errors.push(`${original?.name ?? patches[i].id}: ${r.error}`);
      }
    });
    if (updated.length > 0) {
      setClasses((prev) =>
        prev.map((c) => updated.find((u) => u.id === c.id) ?? c),
      );
    }
    if (errors.length > 0) {
      toast.error(
        `Cập nhật ${updated.length}/${patches.length} lớp. Lỗi: ${errors.slice(0, 2).join("; ")}${
          errors.length > 2 ? "…" : ""
        }`,
      );
    } else {
      toast.success(`Đã cập nhật ${updated.length} lớp.`);
    }
    setBulkAction(null);
    clearSelection();
    router.refresh();
  }

  async function handleBulkYear() {
    const yr = bulkYear.trim();
    if (!yr) {
      toast.error("Nhập năm học mới.");
      return;
    }
    const patches = Array.from(selected).map((id) => ({ id, year_label: yr }));
    await runBulkUpdate(patches);
  }

  async function handleBulkRename() {
    if (!bulkFind) {
      toast.error("Nhập chuỗi cần đổi.");
      return;
    }
    const patches = renamePreview
      .filter((p) => p.changed)
      .map((p) => ({ id: p.id, name: p.to }));
    if (patches.length === 0) {
      toast.info("Không có lớp nào khớp chuỗi để đổi.");
      return;
    }
    await runBulkUpdate(patches);
  }

  // ── Bulk delete ────────────────────────────────────────────────────────
  const [bulkDeleting, setBulkDeleting] = useState(false);
  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Xoá ${ids.length} lớp đã chọn?`,
      variant: "danger",
      confirmLabel: `Xoá ${ids.length} lớp`,
      description:
        "Tất cả slot trên thời khoá biểu của các lớp này sẽ bị xoá theo. Hành động không thể hoàn tác.",
    });
    if (!ok) return;
    setBulkDeleting(true);
    const results = await Promise.all(ids.map((id) => deleteClass(id)));
    setBulkDeleting(false);
    const okCount = results.filter((r) => r.success).length;
    const errCount = results.length - okCount;
    if (okCount > 0) {
      const okSet = new Set(ids.filter((_, i) => results[i].success));
      setClasses((prev) => prev.filter((c) => !okSet.has(c.id)));
    }
    if (errCount === 0) {
      toast.success(`Đã xoá ${okCount} lớp.`);
    } else {
      toast.error(
        `Đã xoá ${okCount}/${results.length} lớp. ${errCount} lớp không xoá được (có ràng buộc).`,
      );
    }
    clearSelection();
    router.refresh();
  }

  // ── Bulk-seed state ────────────────────────────────────────────────────
  const [seedGrade, setSeedGrade] = useState<number>(6);
  const [seedCount, setSeedCount] = useState<number>(8);
  const [seedFormat, setSeedFormat] = useState<ClassNameFormat>("LETTER_NUM");
  // Allow empty during typing; falls back to "A" at preview/submit time so
  // the user can clear the field and re-type without it springing back.
  const [seedLetter, setSeedLetter] = useState<string>("A");
  const effectiveLetter = seedLetter || "A";
  const [seedYear, setSeedYear] = useState<string>(DEFAULT_YEAR);
  const [seeding, setSeeding] = useState(false);

  // 26 = Z. LETTER pattern can't have more than 26 classes per grade.
  const effectiveSeedCount =
    seedFormat === "LETTER" ? Math.min(seedCount, 26) : seedCount;

  const previewNames = useMemo(() => {
    const upto = Math.min(effectiveSeedCount, 6);
    const names = Array.from({ length: upto }, (_, i) =>
      previewClassName(seedGrade, i + 1, seedFormat, effectiveLetter),
    );
    if (effectiveSeedCount > upto) {
      names.push(`… ${previewClassName(seedGrade, effectiveSeedCount, seedFormat, effectiveLetter)}`);
    }
    return names.join(" · ");
  }, [effectiveSeedCount, seedGrade, seedFormat, effectiveLetter]);

  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  async function handleSeed() {
    setSeeding(true);
    const r = await seedGradeClasses({
      grade_level: seedGrade,
      count: effectiveSeedCount,
      format: seedFormat,
      letter: effectiveLetter,
      year_label: seedYear.trim(),
    });
    setSeeding(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const { created, skipped } = r.data!;
    if (created.length > 0) {
      setClasses((prev) => [...prev, ...created]);
    }
    if (created.length === 0) {
      toast.info("Tất cả lớp đã tồn tại trong năm học này.");
    } else if (skipped.length === 0) {
      toast.success(`Đã tạo ${created.length} lớp khối ${seedGrade}.`);
    } else {
      toast.success(
        `Đã tạo ${created.length} lớp · bỏ qua ${skipped.length} lớp đã có.`,
      );
    }
    router.refresh();
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Tên lớp không được để trống.");
      return;
    }
    setPending(true);
    try {
      const r = await createClass({
        name: name.trim(),
        grade_level: typeof grade === "number" ? grade : null,
        year_label: year.trim(),
        homeroom_teacher_id: homeroom || null,
      });
      if (r.success && r.data) {
        setClasses((prev) => [...prev, r.data!]);
        toast.success("Đã tạo lớp.");
        setName("");
        setGrade("");
        setHomeroom("");
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(c: ClassRow) {
    const ok = await confirm({
      title: `Xoá lớp ${c.name}?`,
      variant: "danger",
      confirmLabel: "Xoá lớp",
      description:
        "Tất cả slot thời khoá biểu của lớp này sẽ bị xoá theo. Hành động không thể hoàn tác.",
    });
    if (!ok) return;
    setDeletingId(c.id);
    const r = await deleteClass(c.id);
    setDeletingId(null);
    if (r.success) {
      setClasses((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Đã xoá lớp.");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Unified create panel — toggle between single-class and bulk-by-grade
          modes. Collapsible to save vertical space once the list is populated. */}
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/50">
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-indigo-50"
        >
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
            <Plus className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Tạo lớp</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Thêm 1 lớp hoặc tạo nhanh nhiều lớp theo khối.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${
              createOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence initial={false}>
          {createOpen && (
            <motion.div
              key="create-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-indigo-200/60 px-4 pb-4 pt-3">
                {/* Mode toggle */}
                <div className="mb-3 inline-flex items-center gap-0.5 rounded-lg bg-white/80 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setCreateMode("bulk")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      createMode === "bulk"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Nhiều lớp / khối
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode("single")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      createMode === "single"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    1 lớp
                  </button>
                </div>

                {createMode === "single" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tên lớp · 6A1"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={grade}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setGrade(Number.isFinite(v) ? v : "");
                        }}
                        placeholder="Khối · 6"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="Năm học · 2026-2027"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <select
                        value={homeroom}
                        onChange={(e) => setHomeroom(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">— GVCN (tuỳ chọn) —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Đang
                          thêm...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" /> Thêm lớp
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              Khối lớp
            </label>
            <select
              value={seedGrade}
              onChange={(e) => setSeedGrade(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              Số lớp
            </label>
            <input
              type="number"
              min={1}
              max={seedFormat === "LETTER" ? 26 : 30}
              value={seedCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setSeedCount(n);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              Năm học
            </label>
            <input
              type="text"
              value={seedYear}
              onChange={(e) => setSeedYear(e.target.value)}
              placeholder="2026-2027"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {seedFormat === "LETTER_NUM" && (
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                Ban (chữ)
              </label>
              <input
                type="text"
                value={seedLetter}
                onChange={(e) => {
                  // Take the LAST char typed (so retyping over the current
                  // value works even without selecting it first) and allow
                  // empty so backspace doesn't snap back to "A".
                  const v = e.target.value.toUpperCase().slice(-1);
                  if (v === "" || /^[A-Z]$/.test(v)) setSeedLetter(v);
                }}
                placeholder="A"
                maxLength={1}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono uppercase tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            Định dạng tên lớp
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMAT_OPTIONS.map((opt) => {
              const isActive = seedFormat === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeedFormat(opt.value)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? "border-indigo-500 bg-white shadow-sm"
                      : "border-transparent bg-white/60 hover:bg-white"
                  }`}
                >
                  <p
                    className={`font-mono text-[13px] font-bold ${
                      isActive ? "text-indigo-700" : "text-slate-700"
                    }`}
                  >
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-tight text-slate-500">
                    {opt.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              Xem trước · {effectiveSeedCount} lớp
            </p>
            <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-slate-700">
              {previewNames}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Tạo {effectiveSeedCount} lớp
              </>
            )}
          </button>
        </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Advanced filter panel — replaces the old standalone "Thêm 1 lớp" slot.
          Collapsible; auto-shows the active filter count as a badge so users
          know it's filtering even when collapsed. */}
      {classes.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
          >
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Bộ lọc nâng cao
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Lọc theo khối, năm học, GVCN, hoặc tìm theo tên.
              </p>
            </div>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-100">
                {activeFilterCount} bộ lọc
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${
                filterOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {filterOpen && (
              <motion.div
                key="filter-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
                  {/* Search */}
                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                      Tìm theo tên lớp
                    </p>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={classQuery}
                        onChange={(e) => setClassQuery(e.target.value)}
                        placeholder="VD: 6A, 12C1, ..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  {/* Khối pills */}
                  {gradesInUse.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        Khối
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FilterPill
                          active={gradeFilter === "all"}
                          onClick={() => setGradeFilter("all")}
                          label={`Tất cả`}
                          count={classes.length}
                        />
                        {gradesInUse.map((g) => (
                          <FilterPill
                            key={g}
                            active={gradeFilter === g}
                            onClick={() => setGradeFilter(g)}
                            label={`Khối ${g}`}
                            count={classes.filter((c) => c.grade_level === g).length}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Năm học pills */}
                  {yearsInUse.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        Năm học
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FilterPill
                          active={yearFilter === "all"}
                          onClick={() => setYearFilter("all")}
                          label="Tất cả"
                        />
                        {yearsInUse.map((y) => (
                          <FilterPill
                            key={y}
                            active={yearFilter === y}
                            onClick={() => setYearFilter(y)}
                            label={y}
                            mono
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GVCN status */}
                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                      Giáo viên chủ nhiệm
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FilterPill
                        active={homeroomFilter === "all"}
                        onClick={() => setHomeroomFilter("all")}
                        label="Tất cả"
                      />
                      <FilterPill
                        active={homeroomFilter === "assigned"}
                        onClick={() => setHomeroomFilter("assigned")}
                        label="Đã có GVCN"
                      />
                      <FilterPill
                        active={homeroomFilter === "unassigned"}
                        onClick={() => setHomeroomFilter("unassigned")}
                        label="Chưa có GVCN"
                      />
                    </div>
                  </div>

                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setGradeFilter("all");
                        setYearFilter("all");
                        setHomeroomFilter("all");
                        setClassQuery("");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                      Xoá tất cả bộ lọc
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* List */}
      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <GraduationCap className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            Chưa có lớp nào.
          </p>
          <p className="max-w-md text-xs text-slate-500">
            Thêm các lớp giảng dạy (6A1, 7B2…) để dùng trên grid thời khoá biểu.
          </p>
        </div>
      ) : displayedClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Search className="h-7 w-7 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            Không có lớp khớp bộ lọc.
          </p>
          <button
            type="button"
            onClick={() => {
              setGradeFilter("all");
              setYearFilter("all");
              setHomeroomFilter("all");
              setClassQuery("");
            }}
            className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Xoá tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bulk action bar — only shows when ≥ 1 class is selected.
              Sits above the table so user always sees what's selected. */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white">
                    <CheckSquare className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">
                    Đã chọn{" "}
                    <span className="font-mono tabular-nums">
                      {selected.size}
                    </span>{" "}
                    lớp
                  </p>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                  >
                    Bỏ chọn
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openBulkAction("rename")}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Replace className="h-3.5 w-3.5" />
                    Đổi kí hiệu lớp
                  </button>
                  <button
                    type="button"
                    onClick={() => openBulkAction("year")}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Đổi năm học
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    {bulkDeleting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang xoá...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá đã chọn
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left">
                    {/* Select-all toggles displayed (filtered) classes. */}
                    {(() => {
                      const allOnPage = displayedClasses.every((c) =>
                        selected.has(c.id),
                      );
                      const someOnPage = displayedClasses.some((c) =>
                        selected.has(c.id),
                      );
                      const checked =
                        displayedClasses.length > 0 && allOnPage;
                      return (
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả"
                          checked={checked}
                          ref={(el) => {
                            if (el)
                              el.indeterminate = !checked && someOnPage;
                          }}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (allOnPage) {
                                displayedClasses.forEach((c) =>
                                  next.delete(c.id),
                                );
                              } else {
                                displayedClasses.forEach((c) =>
                                  next.add(c.id),
                                );
                              }
                              return next;
                            });
                          }}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                      );
                    })()}
                  </th>
                  <th className="px-4 py-2.5 text-left">Lớp</th>
                  <th className="px-4 py-2.5 text-left">Khối</th>
                <th className="px-4 py-2.5 text-left">Năm học</th>
                <th className="px-4 py-2.5 text-left">GVCN</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-50">
                {pager.paged.map((c) => {
                  const isSel = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${isSel ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Chọn ${c.name}`}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-900">
                        {c.name}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-700">
                        {c.grade_level ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-500">
                        {c.year_label || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {c.homeroom_teacher_id
                          ? (teacherById.get(c.homeroom_teacher_id)?.display_name ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label={`Chỉnh sửa ${c.name}`}
                            title="Chỉnh sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            disabled={deletingId === c.id}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            aria-label={`Xoá ${c.name}`}
                            title="Xoá"
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination for the filtered class list. */}
          <Pagination
            page={pager.page}
            pageSize={pager.pageSize}
            total={pager.total}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
            pageSizeOptions={[10, 20, 30, 50, 100]}
            unit="lớp"
          />
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeEdit}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Chỉnh sửa lớp{" "}
                    <span className="font-mono text-slate-500">
                      {editing.name}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Đổi tên hoặc gán giáo viên chủ nhiệm.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 2-column body — left = class details, right = teacher list.
                  Teacher list scrolls internally so modal height stays bounded. */}
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_1.2fr] sm:divide-x sm:divide-slate-100">
                {/* LEFT: class details */}
                <div className="space-y-4 px-5 py-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Tên lớp
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="6A1"
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Năm học
                    </label>
                    <input
                      type="text"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      placeholder="2026-2027"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <dl className="space-y-2.5 rounded-xl bg-slate-50/70 px-3.5 py-3 text-[12.5px]">
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                        Khối
                      </dt>
                      <dd className="font-mono tabular-nums text-slate-700">
                        {editing.grade_level ?? "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                        GVCN hiện tại
                      </dt>
                      <dd className="truncate text-slate-700">
                        {editHomeroom
                          ? (teachers.find((t) => t.id === editHomeroom)
                              ?.display_name ?? "—")
                          : "— Chưa có —"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* RIGHT: inline teacher picker (no dropdown) */}
                <div className="flex min-h-0 flex-col px-5 py-5">
                  <p className="mb-2 text-xs font-semibold text-slate-600">
                    Giáo viên chủ nhiệm
                  </p>
                  <TeacherPicker
                    teachers={teachers}
                    value={editHomeroom}
                    onChange={setEditHomeroom}
                    allClasses={classes}
                    currentClassId={editing.id}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdit}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    "Lưu thay đổi"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bulk action modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {bulkAction && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeBulkAction}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {bulkAction === "year"
                      ? "Đổi năm học hàng loạt"
                      : "Đổi kí hiệu lớp hàng loạt"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Áp dụng cho{" "}
                    <span className="font-mono font-semibold tabular-nums text-slate-700">
                      {selected.size}
                    </span>{" "}
                    lớp đã chọn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBulkAction}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {bulkAction === "year" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Năm học mới
                      </label>
                      <input
                        type="text"
                        value={bulkYear}
                        onChange={(e) => setBulkYear(e.target.value)}
                        placeholder="2026-2027"
                        autoFocus
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="rounded-xl bg-slate-50/70 px-3.5 py-3">
                      <p className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                        Sẽ áp dụng cho
                      </p>
                      <p className="mt-1 font-mono text-[12.5px] text-slate-700">
                        {selectedClasses
                          .map((c) => c.name)
                          .sort((a, b) =>
                            a.localeCompare(b, "vi", { numeric: true }),
                          )
                          .join(", ")}
                      </p>
                    </div>
                  </>
                )}

                {bulkAction === "rename" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Tìm chuỗi
                        </label>
                        <input
                          type="text"
                          value={bulkFind}
                          onChange={(e) => setBulkFind(e.target.value)}
                          placeholder="A"
                          autoFocus
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Thay bằng
                        </label>
                        <input
                          type="text"
                          value={bulkReplace}
                          onChange={(e) => setBulkReplace(e.target.value)}
                          placeholder="C"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-500">
                      Sẽ thay <span className="font-mono">lần đầu xuất hiện</span>{" "}
                      của chuỗi trong tên lớp. VD:{" "}
                      <span className="font-mono">A → C</span> biến{" "}
                      <span className="font-mono">6A1, 6A2</span> thành{" "}
                      <span className="font-mono">6C1, 6C2</span>.
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40">
                      <div className="border-b border-slate-100 px-3 py-2">
                        <p className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                          Xem trước · {renamePreview.filter((p) => p.changed).length}
                          /{renamePreview.length} lớp sẽ đổi
                        </p>
                      </div>
                      <ul className="max-h-48 overflow-y-auto py-1 text-sm">
                        {renamePreview.length === 0 ? (
                          <li className="px-3 py-3 text-center text-xs text-slate-400">
                            Chưa chọn lớp nào.
                          </li>
                        ) : (
                          renamePreview.map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center gap-2 px-3 py-1.5"
                            >
                              <span
                                className={`font-mono ${
                                  p.changed
                                    ? "text-slate-500 line-through"
                                    : "text-slate-700"
                                }`}
                              >
                                {p.from}
                              </span>
                              {p.changed && (
                                <>
                                  <span className="text-slate-300">→</span>
                                  <span className="font-mono font-semibold text-indigo-600">
                                    {p.to}
                                  </span>
                                </>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <button
                  type="button"
                  onClick={closeBulkAction}
                  disabled={bulkSavePending}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={
                    bulkAction === "year" ? handleBulkYear : handleBulkRename
                  }
                  disabled={bulkSavePending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {bulkSavePending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang cập nhật...
                    </>
                  ) : (
                    `Áp dụng cho ${selected.size} lớp`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── FilterPill ─────────────────────────────────────────────────────────────
function FilterPill({
  active,
  onClick,
  label,
  count,
  mono,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      } ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {label}
      {count != null && (
        <span
          className={`font-mono tabular-nums ${
            active ? "text-white/70" : "text-slate-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── TeacherPicker ──────────────────────────────────────────────────────────
// Inline searchable list (no dropdown popover). Sits in the right column
// of the edit modal as an always-visible, scrollable list of teachers with
// a search box on top and a "Không có GVCN" sentinel row.
//
// Diacritic-insensitive search (CLAUDE.md §8.3). Teachers who are already
// homeroom of another class get an amber "Đang GVCN: X" badge so the
// admin doesn't double-book; the current class is excluded from the warning.
function TeacherPicker({
  teachers,
  value,
  onChange,
  allClasses,
  currentClassId,
}: {
  teachers: TenantTeacherRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  allClasses?: ClassRow[];
  currentClassId?: string;
}) {
  // Index: teacher_id → list of class names where they are homeroom
  // (excluding the class currently being edited).
  const teacherHomerooms = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!allClasses) return map;
    for (const c of allClasses) {
      if (!c.homeroom_teacher_id) continue;
      if (c.id === currentClassId) continue;
      const list = map.get(c.homeroom_teacher_id) ?? [];
      list.push(c.name);
      map.set(c.homeroom_teacher_id, list);
    }
    // Natural-sort the class names for consistent display.
    for (const list of map.values()) {
      list.sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    }
    return map;
  }, [allClasses, currentClassId]);
  const [query, setQuery] = useState("");

  // Filter by name + email, diacritic-insensitive.
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return teachers;
    return teachers.filter((t) =>
      normalize(`${t.display_name} ${t.email ?? ""}`).includes(q),
    );
  }, [teachers, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200">
      {/* Search bar — sticks to top of the list */}
      <div className="border-b border-slate-100 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm giáo viên…"
            className="w-full rounded-lg border border-transparent bg-slate-50 py-1.5 pl-8 pr-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
        </div>
      </div>

      {/* Scrollable teacher list — capped so the modal stays a fixed height. */}
      <ul className="max-h-[320px] min-h-[200px] overflow-y-auto py-1">
        {/* Clear-sentinel row */}
        <li>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
              value === null
                ? "bg-indigo-50/60 text-slate-900"
                : "text-slate-500"
            }`}
          >
            <span>— Không có GVCN —</span>
            {value === null && (
              <Check className="h-3.5 w-3.5 text-indigo-600" />
            )}
          </button>
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-slate-400">
            Không tìm thấy giáo viên.
          </li>
        ) : (
          filtered.map((t) => {
            const isSelected = t.id === value;
            const conflictClasses = teacherHomerooms.get(t.id) ?? [];
            const hasConflict = conflictClasses.length > 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onChange(t.id)}
                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-indigo-50/60 text-slate-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex min-w-0 flex-1 items-start gap-2">
                    <span
                      className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold text-white"
                      style={{ background: t.color }}
                    >
                      {t.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-medium">
                        {t.display_name}
                      </span>
                      {hasConflict && (
                        <span
                          className="mt-1 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
                          title={`Đang là GVCN của ${conflictClasses.join(", ")}`}
                        >
                          Đang GVCN: {conflictClasses.join(", ")}
                        </span>
                      )}
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-indigo-600" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
