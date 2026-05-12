"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  BookOpen,
  MoreHorizontal,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  GraduationCap,
  DollarSign,
} from "lucide-react";

import type { CourseRow } from "@/types/database";
import { createCourse, deleteCourse } from "@/app/actions/courses";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * CourseDataTable
 * ===============
 * Client Component showing courses in card grid with:
 *   - Create course dialog with form
 *   - Delete with confirmation
 *   - Status badges
 *   - Staggered animation on load
 *   - Toast notifications
 */

// ── Animation Variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CourseRow["status"] }) {
  const styles = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    published: "bg-emerald-50 text-emerald-700 border-emerald-200",
    archived: "bg-slate-50 text-slate-500 border-slate-200",
  };

  const labels = {
    draft: "Nháp",
    published: "Đã xuất bản",
    archived: "Lưu trữ",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <BookOpen className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        Chưa có khóa học nào
      </h3>
      <p className="mt-1.5 text-sm text-slate-500">
        Bắt đầu bằng cách tạo khóa học đầu tiên của bạn.
      </p>
      <motion.button
        type="button"
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        whileTap={{ scale: 0.97 }}
      >
        <Plus className="h-4 w-4" />
        Tạo khóa học
      </motion.button>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface CourseDataTableProps {
  courses: CourseRow[];
}

export default function CourseDataTable({ courses }: CourseDataTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();

  // ── Create Handler ──────────────────────────────────────────────────
  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createCourse(formData);
      if (result.success) {
        toast.success("Khóa học đã được tạo thành công!");
        setCreateOpen(false);
      } else {
        toast.error(result.error || "Không thể tạo khóa học.");
      }
    });
  }

  // ── Delete Handler ──────────────────────────────────────────────────
  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteCourse(deleteTarget.id);
      if (result.success) {
        toast.success(`Đã xóa "${deleteTarget.title}"`);
        setDeleteTarget(null);
      } else {
        toast.error(result.error || "Không thể xóa khóa học.");
      }
    });
  }

  return (
    <div>
      {/* ── Header Bar ─────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Khóa học
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý tất cả khóa học của bạn ({courses.length})
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Plus className="h-4 w-4" />
          Tạo khóa học mới
        </motion.button>
      </div>

      {/* ── Course Grid or Empty State ─────────────────────── */}
      {courses.length === 0 ? (
        <EmptyState onCreateClick={() => setCreateOpen(true)} />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {courses.map((course) => (
            <motion.div
              key={course.id}
              variants={cardVariants}
              className="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md"
            >
              {/* Status + Menu */}
              <div className="flex items-start justify-between">
                <StatusBadge status={course.status} />

                {/* Actions menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setMenuOpen(menuOpen === course.id ? null : course.id)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {menuOpen === course.id && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        onClick={() => {
                          setMenuOpen(null);
                          router.push(`/dashboard/courses/${course.id}`);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        onClick={() => {
                          setMenuOpen(null);
                          toast.info("Xem trước — coming soon!");
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                        Xem trước
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                        onClick={() => {
                          setMenuOpen(null);
                          setDeleteTarget(course);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Info */}
              <div className="mt-4">
                <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
                  {course.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                  {course.description || "Chưa có mô tả"}
                </p>
              </div>

              {/* Stats Row */}
              <div className="mt-5 flex items-center gap-4 border-t border-slate-50 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {course.enrollments_count} học viên
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  {course.lessons_count} bài
                </div>
                <div className="ml-auto text-sm font-semibold text-slate-900">
                  {course.price === 0
                    ? "Miễn phí"
                    : `${course.price.toLocaleString("vi-VN")}₫`}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Create Dialog ──────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo khóa học mới</DialogTitle>
            <DialogDescription>
              Điền thông tin cơ bản. Bạn có thể chỉnh sửa chi tiết sau.
            </DialogDescription>
          </DialogHeader>

          <form action={handleCreate} className="space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="course-title"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tiêu đề khóa học <span className="text-rose-500">*</span>
              </label>
              <input
                id="course-title"
                name="title"
                type="text"
                required
                minLength={3}
                maxLength={200}
                placeholder="Ví dụ: Khóa học IELTS Speaking Band 7+"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="course-description"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Mô tả
              </label>
              <textarea
                id="course-description"
                name="description"
                rows={3}
                maxLength={5000}
                placeholder="Mô tả ngắn gọn về khóa học..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Price */}
            <div>
              <label
                htmlFor="course-price"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Giá (USD)
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="course-price"
                  name="price"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={0}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Để 0 nếu khóa học miễn phí
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
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
                  "Tạo khóa học"
                )}
              </motion.button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa khóa học</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa &ldquo;{deleteTarget?.title}&rdquo;? Hành
              động này không thể hoàn tác. Tất cả bài giảng và dữ liệu liên
              quan sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
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
                "Xóa khóa học"
              )}
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
