"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import type { ModuleRow } from "@/types/database";
import { createModule } from "@/app/actions/curriculum";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * CreateModuleDialog
 * ==================
 * Modal for adding a new chapter/module to a course.
 * Calls createModule server action on submit.
 */

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onCreated: (module: ModuleRow) => void;
}

export default function CreateModuleDialog({
  open,
  onOpenChange,
  courseId,
  onCreated,
}: CreateModuleDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const title = formData.get("title") as string;

    startTransition(async () => {
      const result = await createModule(courseId, title);
      if (result.success && result.data) {
        toast.success("Đã thêm chương mới!");
        onCreated(result.data);
        onOpenChange(false);
      } else {
        toast.error(result.error || "Không thể tạo chương.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm chương mới</DialogTitle>
          <DialogDescription>
            Tạo chương mới để tổ chức các bài học trong khóa học.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-module-title"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Tên chương <span className="text-rose-500">*</span>
            </label>
            <input
              id="new-module-title"
              name="title"
              type="text"
              required
              minLength={1}
              maxLength={200}
              placeholder="Ví dụ: Chương 1 — Giới thiệu"
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

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
                "Thêm chương"
              )}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
