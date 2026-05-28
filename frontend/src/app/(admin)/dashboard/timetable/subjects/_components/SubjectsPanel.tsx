"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  createSubject,
  deleteSubject,
  seedStandardSubjects,
  setSubjectTeachers,
} from "@/modules/timetable/actions";
import type {
  SubjectRow,
  SubjectTeacherRow,
} from "@/modules/timetable/types";
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
  initialSubjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  initialLinks: SubjectTeacherRow[];
}

const PRESET_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#E11D48",
  "#A855F7",
  "#14B8A6",
  "#F97316",
];

export default function SubjectsPanel({
  initialSubjects,
  teachers,
  initialLinks,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [subjects, setSubjects] = useState(initialSubjects);
  const [links, setLinks] = useState(initialLinks);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, setPending] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);

  // Search filter — diacritic-insensitive on name + short_code.
  const [query, setQuery] = useState("");
  const filteredSubjects = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return subjects;
    return subjects.filter((s) =>
      normalize(`${s.name} ${s.short_code}`).includes(q),
    );
  }, [subjects, query]);

  const pager = usePagination(filteredSubjects, 18);

  // Indexes
  const teacherById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t])),
    [teachers],
  );
  const teachersBySubject = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of links) {
      const list = map.get(l.subject_id) ?? [];
      list.push(l.teacher_id);
      map.set(l.subject_id, list);
    }
    return map;
  }, [links]);

  async function handleCreate() {
    if (!name.trim() || !shortCode.trim()) {
      toast.error("Vui lòng nhập tên môn và mã môn.");
      return;
    }
    setPending(true);
    try {
      const r = await createSubject({
        name: name.trim(),
        short_code: shortCode.trim(),
        color,
      });
      if (r.success && r.data) {
        setSubjects((prev) =>
          [...prev, r.data!].sort((a, b) => a.name.localeCompare(b.name, "vi")),
        );
        toast.success("Đã tạo môn.");
        setName("");
        setShortCode("");
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleSeed() {
    const ok = await confirm({
      title: "Tạo các môn học cơ bản (Việt Nam)?",
      confirmLabel: "Tạo",
      description:
        "Sẽ thêm danh sách môn học theo chuẩn Bộ GD&ĐT (Toán, Văn, Anh, Lý, Hoá, Sinh, Sử, Địa, GDCD, Tin, CN, TD, Âm nhạc, Mỹ thuật, QP). Các môn đã tồn tại sẽ được bỏ qua.",
    });
    if (!ok) return;
    setSeeding(true);
    const r = await seedStandardSubjects();
    setSeeding(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const { created, skipped } = r.data!;
    if (created.length > 0) {
      setSubjects((prev) =>
        [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
    }
    if (created.length === 0) {
      toast.info("Tất cả môn cơ bản đã tồn tại.");
    } else if (skipped.length === 0) {
      toast.success(`Đã tạo ${created.length} môn.`);
    } else {
      toast.success(
        `Đã tạo ${created.length} môn · bỏ qua ${skipped.length} môn đã có.`,
      );
    }
    router.refresh();
  }

  async function handleDelete(s: SubjectRow) {
    const ok = await confirm({
      title: `Xoá môn ${s.name}?`,
      variant: "danger",
      confirmLabel: "Xoá môn",
      description:
        "Các slot trên thời khoá biểu đang gán môn này sẽ chặn việc xoá. Hãy gỡ ra trước.",
    });
    if (!ok) return;
    setDeletingId(s.id);
    const r = await deleteSubject(s.id);
    setDeletingId(null);
    if (r.success) {
      setSubjects((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Đã xoá môn.");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* One-click seed for fresh tenants. Shown when ≤ 3 subjects exist;
          after that the user has built their own list and doesn't need it. */}
      {subjects.length <= 3 && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Tạo các môn cơ bản theo chuẩn Việt Nam
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Thêm 15 môn của Bộ GD&amp;ĐT (Toán, Văn, Anh, Lý, Hoá, Sinh,
              Sử, Địa, GDCD, Tin, Công nghệ, Thể dục, Âm nhạc, Mỹ thuật,
              QP-AN). Có thể đổi tên / xoá sau.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Tạo ngay
              </>
            )}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          Thêm môn mới
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên môn · Toán"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="text"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="Mã · T"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm uppercase tracking-wide text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                  color.toUpperCase() === c.toUpperCase()
                    ? "border-slate-900 shadow-sm"
                    : "border-transparent"
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              className="h-7 w-7 cursor-pointer rounded-lg border border-slate-200"
              title="Màu khác"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang thêm...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Thêm
              </>
            )}
          </button>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <LayoutGrid className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            Chưa có môn nào.
          </p>
          <p className="max-w-md text-xs text-slate-500">
            Thêm môn (Toán, Văn, Anh…) cùng mã ngắn và màu để hiển thị gọn
            trên grid thời khoá biểu.
          </p>
        </div>
      ) : (
        <>
          {/* Search filter — diacritic-insensitive. Hidden if there are
              only a handful of subjects (would feel pointless). */}
          {subjects.length > 6 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc mã môn…"
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Xoá tìm kiếm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {filteredSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <Search className="h-7 w-7 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                Không tìm thấy môn khớp.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Xoá tìm kiếm
              </button>
            </div>
          ) : (
            <>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pager.paged.map((s) => {
            const teacherIds = teachersBySubject.get(s.id) ?? [];
            return (
              <li
                key={s.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-mono text-sm font-bold text-white"
                    style={{ background: s.color }}
                  >
                    {s.short_code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {s.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {teacherIds.length > 0
                        ? `${teacherIds.length} giáo viên bộ môn`
                        : "Chưa gán giáo viên"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.id}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    aria-label={`Xoá ${s.name}`}
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Qualified teachers chip row */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {teacherIds.length === 0 ? (
                    <span className="text-[11px] italic text-slate-400">
                      Bấm bên dưới để gán giáo viên bộ môn cho{" "}
                      <strong>{s.name}</strong>.
                    </span>
                  ) : (
                    teacherIds.slice(0, 4).map((tid) => {
                      const t = teacherById.get(tid);
                      if (!t) return null;
                      return (
                        <span
                          key={tid}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700"
                          title={t.display_name}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: t.color }}
                          />
                          {t.display_name}
                        </span>
                      );
                    })
                  )}
                  {teacherIds.length > 4 && (
                    <span className="text-[10.5px] text-slate-400">
                      +{teacherIds.length - 4}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditingSubject(s)}
                  className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Cấu hình giáo viên
                </button>
              </li>
            );
          })}
        </ul>

              <Pagination
                page={pager.page}
                pageSize={pager.pageSize}
                total={pager.total}
                onPageChange={pager.setPage}
                onPageSizeChange={pager.setPageSize}
                pageSizeOptions={[9, 18, 30, 60]}
                unit="môn"
              />
            </>
          )}
        </>
      )}

      <AnimatePresence>
        {editingSubject && (
          <SubjectTeachersModal
            subject={editingSubject}
            teachers={teachers}
            initialTeacherIds={teachersBySubject.get(editingSubject.id) ?? []}
            onClose={() => setEditingSubject(null)}
            onSaved={(subjectId, teacherIds) => {
              // Refresh local links state so the chip row updates instantly.
              setLinks((prev) => {
                const remaining = prev.filter((l) => l.subject_id !== subjectId);
                const stamp = new Date().toISOString();
                const added: SubjectTeacherRow[] = teacherIds.map((tid) => ({
                  id: `tmp-${subjectId}-${tid}`,
                  tenant_id: "",
                  subject_id: subjectId,
                  teacher_id: tid,
                  created_at: stamp,
                }));
                return [...remaining, ...added];
              });
              setEditingSubject(null);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Multi-select teachers modal ─────────────────────────────────────────

function SubjectTeachersModal({
  subject,
  teachers,
  initialTeacherIds,
  onClose,
  onSaved,
}: {
  subject: SubjectRow;
  teachers: TenantTeacherRow[];
  initialTeacherIds: string[];
  onClose: () => void;
  onSaved: (subjectId: string, teacherIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialTeacherIds),
  );
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    try {
      const r = await setSubjectTeachers(subject.id, [...selected]);
      if (r.success && r.data) {
        const { added, removed } = r.data;
        if (added > 0 || removed > 0) {
          toast.success(
            `Đã cập nhật: +${added} / −${removed} giáo viên bộ môn.`,
          );
        } else {
          toast.success("Không có thay đổi.");
        }
        onSaved(subject.id, [...selected]);
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !pending && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-mono text-sm font-bold text-white"
              style={{ background: subject.color }}
            >
              {subject.short_code}
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                Giáo viên bộ môn
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                {subject.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Chọn các giáo viên có thể dạy môn này. Khi xếp thời khoá biểu,
                các giáo viên này sẽ hiện trước.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {teachers.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-slate-400">
              Chưa có giáo viên nào trong trung tâm.
            </p>
          ) : (
            <ul className="space-y-1">
              {teachers.map((t) => {
                const isChecked = selected.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isChecked
                          ? "border-indigo-300 bg-indigo-50/60"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-md border ${
                          isChecked
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {t.display_name}
                        </p>
                        {t.email && (
                          <p className="font-mono text-[10px] text-slate-400">
                            {t.email}
                          </p>
                        )}
                      </div>
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      {t.is_admin && (
                        <span className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
                          Quản trị
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-6 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Đã chọn{" "}
            <span className="font-semibold text-slate-900">{selected.size}</span>{" "}
            / {teachers.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
