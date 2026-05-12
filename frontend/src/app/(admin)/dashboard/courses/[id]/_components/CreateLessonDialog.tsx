"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import type { LessonRow, LessonType } from "@/types/database";
import { createLesson } from "@/app/actions/curriculum";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * CreateLessonDialog
 * ==================
 * Modal for adding a new lesson to a module.
 * Calls createLesson server action on submit.
 */

interface CreateLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  courseId: string;
  onCreated: (lesson: LessonRow) => void;
}

export default function CreateLessonDialog({
  open,
  onOpenChange,
  moduleId,
  courseId,
  onCreated,
}: CreateLessonDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const title = formData.get("title") as string;
    const lessonType = (formData.get("lesson_type") as LessonType) || "video";

    startTransition(async () => {
      const result = await createLesson(moduleId, courseId, title, lessonType);
      if (result.success && result.data) {
        toast.success("Đã thêm bài học mới!");
        onCreated(result.data);
        onOpenChange(false);
      } else {
        toast.error(result.error || "Không thể tạo bài học.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bài học mới</DialogTitle>
          <DialogDescription>
            Tạo bài học mới trong chương này. Bạn có thể thay đổi nội dung sau.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="new-lesson-title"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Tên bài học <span className="text-rose-500">*</span>
            </label>
            <input
              id="new-lesson-title"
              name="title"
              type="text"
              required
              minLength={1}
              maxLength={200}
              placeholder="Ví dụ: Giới thiệu Speaking Part 1"
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Lesson Type */}
          <div>
            <label
              htmlFor="new-lesson-type"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Loại bài học
            </label>
            <select
              id="new-lesson-type"
              name="lesson_type"
              defaultValue="video"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="video">🎬 Video</option>
              <option value="text">📄 Văn bản</option>
              <option value="quiz">❓ Quiz</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Hủy
            </button>
            <motion.button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              whileTap={isPending ? {} : { scale: 0.97 }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Thêm bài học"
              )}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
