"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  Trash2,
  Pencil,
  MoreHorizontal,
  Loader2,
  Eye,
  EyeOff,
  SquarePen,
} from "lucide-react";

import type { LessonRow, LessonType } from "@/types/database";
import { deleteLesson, updateLesson } from "@/app/actions/curriculum";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * LessonItem
 * ==========
 * A single lesson row within a Module, with:
 *   - Drag handle (GripVertical)
 *   - Type icon (Video/Text/Quiz)
 *   - Title + inline edit
 *   - Published badge
 *   - Actions dropdown (Edit, Toggle visibility, Delete)
 */

// ── Type Icon Mapping ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<LessonType, { icon: typeof Video; label: string; color: string }> = {
  video: { icon: Video, label: "Video", color: "text-blue-500" },
  text: { icon: FileText, label: "Văn bản", color: "text-emerald-500" },
  quiz: { icon: HelpCircle, label: "Quiz", color: "text-amber-500" },
};

// ── Component ─────────────────────────────────────────────────────────────

interface LessonItemProps {
  lesson: LessonRow;
  courseId: string;
  onDelete: (lessonId: string) => void;
  onUpdate: (lesson: LessonRow) => void;
}

export default function LessonItem({
  lesson,
  courseId,
  onDelete,
  onUpdate,
}: LessonItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdating, startUpdateTransition] = useTransition();
  const router = useRouter();

  // ── dnd-kit sortable ────────────────────────────────────────
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeConfig = TYPE_CONFIG[lesson.lesson_type] || TYPE_CONFIG.video;
  const TypeIcon = typeConfig.icon;

  // ── Delete Handler ──────────────────────────────────────────
  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteLesson(lesson.id, courseId);
      if (result.success) {
        toast.success(`Đã xóa bài "${lesson.title}"`);
        onDelete(lesson.id);
        setDeleteOpen(false);
      } else {
        toast.error(result.error || "Không thể xóa bài học.");
      }
    });
  }

  // ── Toggle Published ────────────────────────────────────────
  function handleTogglePublished() {
    startUpdateTransition(async () => {
      const result = await updateLesson(lesson.id, courseId, {
        is_published: !lesson.is_published,
      });
      if (result.success && result.data) {
        onUpdate(result.data);
        toast.success(
          result.data.is_published ? "Bài học đã hiển thị" : "Bài học đã ẩn",
        );
      } else {
        toast.error(result.error || "Không thể cập nhật.");
      }
    });
    setMenuOpen(false);
  }

  // ── Edit Submit ─────────────────────────────────────────────
  function handleEditSubmit(formData: FormData) {
    const title = formData.get("title") as string;
    const lessonType = formData.get("lesson_type") as LessonType;

    startUpdateTransition(async () => {
      const result = await updateLesson(lesson.id, courseId, {
        title,
        lesson_type: lessonType,
      });
      if (result.success && result.data) {
        onUpdate(result.data);
        toast.success("Đã cập nhật bài học.");
        setEditOpen(false);
      } else {
        toast.error(result.error || "Không thể cập nhật.");
      }
    });
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-all duration-150
          ${isDragging
            ? "z-50 border-primary/30 shadow-lg shadow-primary/10 ring-2 ring-primary/20"
            : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
          }`}
      >
        {/* Drag Handle */}
        <button
          type="button"
          className="flex-shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Type Icon */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 ${typeConfig.color}`}
        >
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Title — click to open editor */}
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => router.push(`/dashboard/courses/${courseId}/lessons/${lesson.id}`)}
        >
          <p className="truncate text-sm font-medium text-slate-700 transition-colors hover:text-indigo-600">
            {lesson.title}
          </p>
          <p className="text-[11px] text-slate-400">{typeConfig.label}</p>
        </div>

        {/* Published Badge */}
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            lesson.is_published
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-50 text-slate-400"
          }`}
        >
          {lesson.is_published ? "Hiển thị" : "Ẩn"}
        </span>

        {/* Actions */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/dashboard/courses/${courseId}/lessons/${lesson.id}`);
                  }}
                >
                  <SquarePen className="h-3.5 w-3.5 text-slate-400" />
                  Soạn nội dung
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-400" />
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={handleTogglePublished}
                  disabled={isUpdating}
                >
                  {lesson.is_published ? (
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  {lesson.is_published ? "Ẩn bài học" : "Hiển thị"}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài học</DialogTitle>
            <DialogDescription>Cập nhật tên và loại bài học.</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`edit-lesson-title-${lesson.id}`}
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tên bài học <span className="text-rose-500">*</span>
              </label>
              <input
                id={`edit-lesson-title-${lesson.id}`}
                name="title"
                type="text"
                required
                defaultValue={lesson.title}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label
                htmlFor={`edit-lesson-type-${lesson.id}`}
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Loại bài học
              </label>
              <select
                id={`edit-lesson-type-${lesson.id}`}
                name="lesson_type"
                defaultValue={lesson.lesson_type}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="video">🎬 Video</option>
                <option value="text">📄 Văn bản</option>
                <option value="quiz">❓ Quiz</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <motion.button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                whileTap={isUpdating ? {} : { scale: 0.97 }}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </motion.button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────── */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa bài học</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa &ldquo;{lesson.title}&rdquo;? Hành động này
              không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Hủy
            </button>
            <motion.button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              whileTap={isDeleting ? {} : { scale: 0.97 }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                "Xóa bài học"
              )}
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
