"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  type AdminCourseRow,
  createAdminCourse,
  deleteAdminCourse,
} from "@/app/actions/admin-courses";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  initialCourses: AdminCourseRow[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function CoursesAdminPanel({ initialCourses }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [courses, setCourses] = useState<AdminCourseRow[]>(initialCourses);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
  }

  function handleCreate() {
    if (!title.trim()) {
      toast.error("Tên khóa học không được để trống.");
      return;
    }
    startTransition(async () => {
      const result = await createAdminCourse({
        title: title.trim(),
        description: description.trim(),
      });
      if (result.success && result.data) {
        setCourses((prev) => [result.data!, ...prev]);
        toast.success("Đã tạo khóa học.");
        resetForm();
        setIsCreateOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Không thể tạo khóa học.");
      }
    });
  }

  async function handleDelete(course: AdminCourseRow) {
    const ok = await confirm({
      title: `Xoá khoá học "${course.title}"?`,
      variant: "danger",
      confirmLabel: "Xoá khoá học",
      description:
        "Hành động này không thể hoàn tác. Các buổi học đang liên kết sẽ chặn việc xoá — bạn cần gỡ liên kết trước.",
    });
    if (!ok) return;
    setDeletingId(course.id);
    startTransition(async () => {
      const result = await deleteAdminCourse(course.id);
      if (result.success) {
        setCourses((prev) => prev.filter((c) => c.id !== course.id));
        toast.success("Đã xóa khóa học.");
        router.refresh();
      } else {
        toast.error(result.error || "Không thể xóa khóa học.");
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
          {courses.length} khóa học
        </p>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Tạo khóa học
        </button>
      </div>

      {/* List */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Chưa có khóa học nào.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Tạo khóa học đầu tiên để các buổi học có thể liên kết.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {c.title}
                  </p>
                  {c.description?.trim() && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    Tạo {formatDate(c.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  disabled={deletingId === c.id}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Xóa ${c.title}`}
                >
                  {deletingId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !isPending && setIsCreateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Tạo khóa học
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1.5 text-xs font-medium text-slate-600">
                    Tên khóa học *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: IELTS 6.5+ buổi tối"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Mô tả</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      (tùy chọn)
                    </span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Mô tả ngắn để giáo viên dễ nhận diện"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    "Tạo khóa học"
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
