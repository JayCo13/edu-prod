"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { PublicLesson, LessonRow } from "@/types/database";
import { getLessonContent } from "@/app/actions/student";
import SecureVideoPlayer from "@/components/shared/SecureVideoPlayer";

/**
 * PreviewDialog
 * =============
 * Full-screen modal for previewing free lessons on the storefront.
 * Fetches full lesson content (since is_free_preview allows it),
 * then renders the appropriate player.
 */

interface PreviewDialogProps {
  lesson: PublicLesson | null;
  courseId: string;
  onClose: () => void;
}

export default function PreviewDialog({
  lesson,
  courseId,
  onClose,
}: PreviewDialogProps) {
  const [lessonData, setLessonData] = useState<LessonRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lesson) {
      setLessonData(null);
      return;
    }

    setLoading(true);
    getLessonContent(lesson.id, courseId)
      .then((result) => {
        if (result.success && result.data) {
          setLessonData(result.data);
        }
      })
      .finally(() => setLoading(false));
  }, [lesson, courseId]);

  return (
    <AnimatePresence>
      {lesson && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-800/80 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="border-b border-slate-800 px-6 py-4">
              <p className="text-xs font-medium text-indigo-400">
                Xem trước miễn phí
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {lesson.title}
              </h3>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex aspect-video items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                </div>
              ) : lessonData?.lesson_type === "video" &&
                lessonData.video_url?.startsWith("bunny://") ? (
                <SecureVideoPlayer
                  videoId={lessonData.video_url.replace("bunny://", "")}
                />
              ) : lessonData?.lesson_type === "text" && lessonData.content ? (
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: lessonData.content }}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-slate-500">
                  Không có nội dung để xem trước.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
