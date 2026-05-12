"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Trophy,
} from "lucide-react";

import type {
  LessonRow,
  PublicModuleWithLessons,
  LessonProgressRow,
} from "@/types/database";
import { toggleLessonProgress } from "@/app/actions/student";
import CurriculumAccordion from "@/components/shared/CurriculumAccordion";
import SecureVideoPlayer from "@/components/shared/SecureVideoPlayer";

/**
 * LessonViewer
 * ============
 * Main learning interface — two-panel layout:
 *   Left (75%): Video/Text content + "Complete & Next" button
 *   Right (25%): Curriculum sidebar with progress
 */

interface LessonViewerProps {
  lesson: LessonRow;
  courseId: string;
  courseSlug: string;
  modules: PublicModuleWithLessons[];
  progress: LessonProgressRow[];
  nextLessonId: string | null;
  lessonBaseUrl: string;
}

export default function LessonViewer({
  lesson,
  courseId,
  courseSlug,
  modules,
  progress,
  nextLessonId,
  lessonBaseUrl,
}: LessonViewerProps) {
  const router = useRouter();
  const [isCompleting, startCompleteTransition] = useTransition();

  const completedIds = new Set(
    progress.filter((p) => p.is_completed).map((p) => p.lesson_id),
  );
  const isCurrentCompleted = completedIds.has(lesson.id);
  const [localCompleted, setLocalCompleted] = useState(isCurrentCompleted);

  function handleCompleteAndNext() {
    startCompleteTransition(async () => {
      // Mark as completed
      if (!localCompleted) {
        const result = await toggleLessonProgress(lesson.id, courseId, true);
        if (result.success) {
          setLocalCompleted(true);
          toast.success("Đã hoàn thành bài học!");
        } else {
          toast.error(result.error || "Không thể cập nhật tiến độ.");
          return;
        }
      }

      // Navigate to next lesson
      if (nextLessonId) {
        router.push(`${lessonBaseUrl}/${nextLessonId}`);
      } else {
        toast.success("Chúc mừng! Bạn đã hoàn thành khóa học! 🎉");
      }
    });
  }

  // Include current lesson as completed for the sidebar
  const displayCompletedIds = new Set(completedIds);
  if (localCompleted) displayCompletedIds.add(lesson.id);

  return (
    <div className="flex h-full">
      {/* ── Content Area (Left) ─────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Video or Text Content */}
        <div className="flex-1 p-6">
          {lesson.lesson_type === "video" &&
          lesson.video_url?.startsWith("bunny://") ? (
            <div className="mx-auto max-w-4xl">
              <SecureVideoPlayer
                videoId={lesson.video_url.replace("bunny://", "")}
                className="shadow-2xl"
              />
            </div>
          ) : lesson.lesson_type === "video" && lesson.video_url ? (
            <div className="mx-auto max-w-4xl">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
                <iframe
                  src={lesson.video_url}
                  title={lesson.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : lesson.lesson_type === "text" && lesson.content ? (
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-6 text-2xl font-bold text-white">
                {lesson.title}
              </h1>
              <div
                className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-a:text-indigo-400 prose-strong:text-slate-200 prose-code:text-pink-400 prose-blockquote:border-slate-600 prose-blockquote:text-slate-400"
                dangerouslySetInnerHTML={{ __html: lesson.content }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              <p>Nội dung bài học đang được cập nhật.</p>
            </div>
          )}
        </div>

        {/* Complete & Next Button */}
        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              {localCompleted ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Đã hoàn thành</span>
                </>
              ) : (
                <span>Chưa hoàn thành</span>
              )}
            </div>

            <motion.button
              type="button"
              onClick={handleCompleteAndNext}
              disabled={isCompleting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              whileTap={isCompleting ? {} : { scale: 0.97 }}
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : nextLessonId ? (
                <>
                  {localCompleted ? "Sang bài tiếp" : "Hoàn thành & Sang bài tiếp"}
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4" />
                  {localCompleted ? "Hoàn thành khóa học" : "Hoàn thành bài cuối"}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Sidebar (Right) ─────────────────────────── */}
      <aside className="hidden w-80 flex-shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/50 p-4 xl:block">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Nội dung khóa học
        </h3>
        <CurriculumAccordion
          modules={modules}
          mode="learning"
          completedLessonIds={displayCompletedIds}
          currentLessonId={lesson.id}
          lessonBaseUrl={lessonBaseUrl}
        />
      </aside>
    </div>
  );
}
