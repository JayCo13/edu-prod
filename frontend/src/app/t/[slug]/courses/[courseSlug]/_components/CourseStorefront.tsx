"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen,
  Clock,
  Users,
  Play,
  ShoppingCart,
  Sparkles,
  GraduationCap,
} from "lucide-react";

import type { PublicCourseDetails, PublicLesson } from "@/types/database";
import { enrollFreeCourse } from "@/app/actions/student";
import CurriculumAccordion from "@/components/shared/CurriculumAccordion";
import PreviewDialog from "./PreviewDialog";

/**
 * CourseStorefront
 * ================
 * Two-column sales page layout.
 * Left: Course info + curriculum accordion.
 * Right: Sticky sidebar with thumbnail, price, CTA.
 */

interface CourseStorefrontProps {
  course: PublicCourseDetails;
  tenantSlug: string;
}

export default function CourseStorefront({
  course,
  tenantSlug,
}: CourseStorefrontProps) {
  const [previewLesson, setPreviewLesson] = useState<PublicLesson | null>(null);
  const [isEnrolling, startEnrollTransition] = useTransition();
  const router = useRouter();

  const isFree = course.price === 0;
  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0,
  );
  const totalDuration = course.modules.reduce(
    (sum, m) =>
      sum + m.lessons.reduce((s, l) => s + (l.video_duration || 0), 0),
    0,
  );

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} giờ ${mins} phút`;
    return `${mins} phút`;
  }

  function formatPrice(price: number, currency: string): string {
    if (price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency || "VND",
      maximumFractionDigits: 0,
    }).format(price);
  }

  function handleCTA() {
    if (isFree) {
      startEnrollTransition(async () => {
        const result = await enrollFreeCourse(course.id);
        if (result.success) {
          toast.success("Đã đăng ký thành công! Chuyển đến phòng học...");
          router.push(`/learn/${course.slug}`);
        } else {
          toast.error(result.error || "Không thể đăng ký.");
        }
      });
    } else {
      toast.info("Chức năng thanh toán đang được phát triển.", {
        description: "Vui lòng quay lại sau.",
      });
    }
  }

  return (
    <>
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div className="border-b bg-muted/30 py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-4">
            <GraduationCap className="h-5 w-5" />
            <span>{course.teacher?.display_name || "Giáo viên"}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {course.title}
          </h1>
          {course.description && (
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
              <BookOpen className="h-4 w-4" />
              {totalLessons} bài học
            </span>
            {totalDuration > 0 && (
              <span className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                <Clock className="h-4 w-4" />
                {formatDuration(totalDuration)}
              </span>
            )}
            <span className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
              <Users className="h-4 w-4" />
              {course.enrollments_count} học viên
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout ───────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 relative">
          {/* ── Left Column: Curriculum (Takes 2 columns) ──────────────── */}
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-card-foreground">
                Nội dung khóa học
              </h2>
              <CurriculumAccordion
                modules={course.modules}
                mode="storefront"
                onPreviewLesson={setPreviewLesson}
              />
            </div>
          </div>

          {/* ── Right Column: Sticky Sidebar (Takes 1 column) ─────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {/* Thumbnail */}
              {course.thumbnail_url ? (
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/60 transition-colors">
                    <div className="rounded-full bg-background/80 p-4 shadow-sm backdrop-blur-sm">
                      <Play className="h-8 w-8 text-foreground" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}

              {/* Price + CTA */}
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-4xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatPrice(course.price, course.currency)}
                  </p>
                </div>

                <motion.button
                  type="button"
                  onClick={handleCTA}
                  disabled={isEnrolling}
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg px-6 py-4 text-base font-bold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 bg-primary text-primary-foreground hover:bg-primary/90"
                  whileTap={isEnrolling ? {} : { scale: 0.98 }}
                >
                  {isEnrolling ? (
                    "Đang xử lý..."
                  ) : isFree ? (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Học miễn phí
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5" />
                      Mua khóa học
                    </>
                  )}
                </motion.button>

                {/* Trust Badges & Quick Stats */}
                <div className="mt-6 space-y-4 pt-6 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tổng bài học</span>
                    <span className="font-semibold text-foreground">
                      {totalLessons} bài
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Chương</span>
                    <span className="font-semibold text-foreground">
                      {course.modules.length} phần
                    </span>
                  </div>
                  {totalDuration > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tổng thời lượng</span>
                      <span className="font-semibold text-foreground">
                        {formatDuration(totalDuration)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm pt-2">
                    <span className="text-muted-foreground">Quyền truy cập</span>
                    <span className="font-semibold text-foreground">Trọn đời</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Preview Dialog ──────────────────────────────── */}
      <PreviewDialog
        lesson={previewLesson}
        courseId={course.id}
        onClose={() => setPreviewLesson(null)}
      />
    </>
  );
}
