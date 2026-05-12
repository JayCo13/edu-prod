"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  FileText,
  HelpCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

import type { LessonRow, LessonType } from "@/types/database";
import TextEditor from "./TextEditor";
import VideoEditor from "./VideoEditor";

/**
 * LessonEditor
 * ============
 * Dynamic editor that renders different sub-editors based on lesson_type.
 *
 * Switch-case architecture:
 *   - 'text'  → <TextEditor />   (TipTap rich-text)
 *   - 'video' → <VideoEditor />  (URL input + preview)
 *   - 'quiz'  → placeholder (future phase)
 *
 * Smooth transitions between editors via AnimatePresence.
 */

// ── Type Config ───────────────────────────────────────────────────────────

const TYPE_META: Record<
  LessonType,
  { icon: typeof Video; label: string; color: string; bgColor: string }
> = {
  video: {
    icon: Video,
    label: "Video",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  text: {
    icon: FileText,
    label: "Văn bản",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  quiz: {
    icon: HelpCircle,
    label: "Quiz",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
};

// ── Component ─────────────────────────────────────────────────────────────

interface LessonEditorProps {
  lesson: LessonRow;
  courseId: string;
}

export default function LessonEditor({ lesson, courseId }: LessonEditorProps) {
  const [currentLesson, setCurrentLesson] = useState<LessonRow>(lesson);

  const meta = TYPE_META[currentLesson.lesson_type] || TYPE_META.video;
  const TypeIcon = meta.icon;

  function handleSaved(updated: LessonRow) {
    setCurrentLesson(updated);
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* ── Back Navigation ───────────────────────────── */}
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại Khung chương trình
      </Link>

      {/* ── Lesson Header ─────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Type Icon */}
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${meta.bgColor} ${meta.color}`}
          >
            <TypeIcon className="h-6 w-6" />
          </div>

          {/* Title + Meta */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {currentLesson.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {/* Type Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bgColor} ${meta.color}`}
              >
                <TypeIcon className="h-3 w-3" />
                {meta.label}
              </span>

              {/* Published Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  currentLesson.is_published
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {currentLesson.is_published ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                {currentLesson.is_published ? "Hiển thị" : "Ẩn"}
              </span>

              {/* Free Preview Badge */}
              {currentLesson.is_free_preview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                  <Eye className="h-3 w-3" />
                  Xem thử miễn phí
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dynamic Editor ────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLesson.lesson_type}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {renderEditor(currentLesson, courseId, handleSaved)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Editor Renderer (Switch-Case) ─────────────────────────────────────────

function renderEditor(
  lesson: LessonRow,
  courseId: string,
  onSaved: (lesson: LessonRow) => void,
) {
  switch (lesson.lesson_type) {
    case "text":
      return (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText className="h-4 w-4 text-emerald-500" />
            Soạn nội dung văn bản
          </h2>
          <TextEditor lesson={lesson} courseId={courseId} onSaved={onSaved} />
        </div>
      );

    case "video":
      return (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Video className="h-4 w-4 text-blue-500" />
            Cài đặt Video
          </h2>
          <VideoEditor lesson={lesson} courseId={courseId} onSaved={onSaved} />
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center py-12 text-center">
          <HelpCircle className="h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            Loại bài học chưa được hỗ trợ
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">
            Trình soạn thảo cho loại bài &ldquo;{lesson.lesson_type}&rdquo; đang
            được phát triển. Vui lòng quay lại sau.
          </p>
        </div>
      );
  }
}
