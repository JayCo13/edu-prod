"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  GripVertical,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  MoreHorizontal,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
} from "lucide-react";

import type { LessonRow, ModuleWithLessons } from "@/types/database";
import { deleteModule, updateModule } from "@/app/actions/curriculum";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import LessonItem from "./LessonItem";
import CreateLessonDialog from "./CreateLessonDialog";

/**
 * ModuleItem
 * ==========
 * A collapsible card for a single Module (chapter).
 *
 * Features:
 *   - Drag handle to reorder modules
 *   - Collapsible body containing sortable LessonItems
 *   - Add lesson button
 *   - Actions menu (Edit, Toggle visibility, Delete)
 *   - Nested SortableContext for lessons
 */

interface ModuleItemProps {
  module: ModuleWithLessons;
  courseId: string;
  onDeleteModule: (moduleId: string) => void;
  onUpdateModule: (module: ModuleWithLessons) => void;
  onLessonCreated: (moduleId: string, lesson: LessonRow) => void;
  onLessonDeleted: (moduleId: string, lessonId: string) => void;
  onLessonUpdated: (moduleId: string, lesson: LessonRow) => void;
}

export default function ModuleItem({
  module,
  courseId,
  onDeleteModule,
  onUpdateModule,
  onLessonCreated,
  onLessonDeleted,
  onLessonUpdated,
}: ModuleItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdating, startUpdateTransition] = useTransition();

  // ── dnd-kit sortable (for module-level drag) ────────────────
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, data: { type: "module" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const lessonIds = module.lessons.map((l) => l.id);

  // ── Delete Handler ──────────────────────────────────────────
  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteModule(module.id, courseId);
      if (result.success) {
        toast.success(`Đã xóa chương "${module.title}"`);
        onDeleteModule(module.id);
        setDeleteOpen(false);
      } else {
        toast.error(result.error || "Không thể xóa chương.");
      }
    });
  }

  // ── Toggle Published ────────────────────────────────────────
  function handleTogglePublished() {
    startUpdateTransition(async () => {
      const result = await updateModule(module.id, courseId, {
        is_published: !module.is_published,
      });
      if (result.success && result.data) {
        onUpdateModule({ ...module, ...result.data });
        toast.success(
          result.data.is_published ? "Chương đã hiển thị" : "Chương đã ẩn",
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

    startUpdateTransition(async () => {
      const result = await updateModule(module.id, courseId, { title });
      if (result.success && result.data) {
        onUpdateModule({ ...module, ...result.data });
        toast.success("Đã cập nhật chương.");
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
        className={`rounded-2xl border transition-all duration-200
          ${isDragging
            ? "z-50 border-primary/30 bg-white shadow-xl shadow-primary/10 ring-2 ring-primary/20"
            : "border-slate-200 bg-white shadow-sm hover:shadow-md"
          }`}
      >
        {/* ── Module Header ───────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Drag Handle */}
          <button
            type="button"
            className="flex-shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Title + Count */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {module.title}
            </h3>
            <p className="text-[11px] text-slate-400">
              {module.lessons.length} bài học
            </p>
          </div>

          {/* Published Badge */}
          <span
            className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              module.is_published
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-50 text-slate-400"
            }`}
          >
            {module.is_published ? "Hiển thị" : "Ẩn"}
          </span>

          {/* Actions Menu */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            >
              <MoreHorizontal className="h-4 w-4" />
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
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-400" />
                    Chỉnh sửa tên
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    onClick={handleTogglePublished}
                    disabled={isUpdating}
                  >
                    {module.is_published ? (
                      <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {module.is_published ? "Ẩn chương" : "Hiển thị"}
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
                    Xóa chương
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Lessons List (Collapsible) ──────────────────── */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="lessons"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                {module.lessons.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 py-8">
                    <BookOpen className="h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-400">
                      Chưa có bài học nào
                    </p>
                  </div>
                ) : (
                  <SortableContext
                    items={lessonIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {module.lessons.map((lesson) => (
                        <LessonItem
                          key={lesson.id}
                          lesson={lesson}
                          courseId={courseId}
                          onDelete={(lessonId) =>
                            onLessonDeleted(module.id, lessonId)
                          }
                          onUpdate={(updated) =>
                            onLessonUpdated(module.id, updated)
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}

                {/* Add Lesson Button */}
                <motion.button
                  type="button"
                  onClick={() => setAddLessonOpen(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="h-4 w-4" />
                  Thêm bài học
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Edit Module Dialog ──────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa chương</DialogTitle>
            <DialogDescription>Cập nhật tên chương.</DialogDescription>
          </DialogHeader>
          <form action={handleEditSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`edit-module-title-${module.id}`}
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tên chương <span className="text-rose-500">*</span>
              </label>
              <input
                id={`edit-module-title-${module.id}`}
                name="title"
                type="text"
                required
                defaultValue={module.title}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
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

      {/* ── Delete Module Confirmation Dialog ───────────────── */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa chương</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa &ldquo;{module.title}&rdquo;?{" "}
              <strong>Tất cả {module.lessons.length} bài học</strong> bên trong
              sẽ bị xóa vĩnh viễn.
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
                "Xóa chương"
              )}
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Lesson Dialog ──────────────────────────────── */}
      <CreateLessonDialog
        open={addLessonOpen}
        onOpenChange={setAddLessonOpen}
        moduleId={module.id}
        courseId={courseId}
        onCreated={(lesson) => onLessonCreated(module.id, lesson)}
      />
    </>
  );
}
