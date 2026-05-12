"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ChevronDown,
  Video,
  FileText,
  HelpCircle,
  PlayCircle,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";

import type { PublicModuleWithLessons, PublicLesson, LessonType } from "@/types/database";

/**
 * CurriculumAccordion
 * ===================
 * Reusable accordion for the course curriculum.
 * Two modes:
 *   - "storefront": Read-only display, free-preview play button
 *   - "learning": Interactive, checkboxes, current lesson highlight, navigation links
 */

const TYPE_ICON: Record<LessonType, typeof Video> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
};

const TYPE_COLOR: Record<LessonType, string> = {
  video: "text-blue-400",
  text: "text-emerald-400",
  quiz: "text-amber-400",
};

interface CurriculumAccordionProps {
  modules: PublicModuleWithLessons[];
  mode: "storefront" | "learning";
  /** Learning mode: set of completed lesson IDs */
  completedLessonIds?: Set<string>;
  /** Learning mode: currently active lesson ID */
  currentLessonId?: string;
  /** Learning mode: base URL for lesson navigation */
  lessonBaseUrl?: string;
  /** Storefront mode: callback when clicking a free preview lesson */
  onPreviewLesson?: (lesson: PublicLesson) => void;
}

export default function CurriculumAccordion({
  modules,
  mode,
  completedLessonIds = new Set(),
  currentLessonId,
  lessonBaseUrl = "",
  onPreviewLesson,
}: CurriculumAccordionProps) {
  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    // In learning mode, auto-open the module containing the current lesson
    if (mode === "learning" && currentLessonId) {
      const mod = modules.find((m) =>
        m.lessons.some((l) => l.id === currentLessonId),
      );
      return new Set(mod ? [mod.id] : [modules[0]?.id].filter(Boolean));
    }
    // In storefront mode, open the first module
    return new Set(modules[0] ? [modules[0].id] : []);
  });

  function toggleModule(moduleId: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  // Count totals
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDuration = modules.reduce(
    (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.video_duration || 0), 0),
    0,
  );

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} phút`;
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>{modules.length} chương</span>
        <span>•</span>
        <span>{totalLessons} bài học</span>
        {totalDuration > 0 && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(totalDuration)}
            </span>
          </>
        )}
      </div>

      {/* Module List */}
      <div className="space-y-2">
        {modules.map((mod) => {
          const isOpen = openModules.has(mod.id);
          const moduleCompletedCount = mod.lessons.filter((l) =>
            completedLessonIds.has(l.id),
          ).length;

          return (
            <div
              key={mod.id}
              className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm"
            >
              {/* Module Header */}
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-700/30"
              >
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                    isOpen ? "rotate-0" : "-rotate-90"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {mod.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {mod.lessons.length} bài học
                    {mode === "learning" && mod.lessons.length > 0 && (
                      <> • {moduleCompletedCount}/{mod.lessons.length} hoàn thành</>
                    )}
                  </p>
                </div>

                {/* Module completion indicator (learning mode) */}
                {mode === "learning" && moduleCompletedCount === mod.lessons.length && mod.lessons.length > 0 && (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                )}
              </button>

              {/* Lesson List */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className="border-t border-slate-700/30 px-2 pb-2">
                      {mod.lessons.map((lesson) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          mode={mode}
                          isCompleted={completedLessonIds.has(lesson.id)}
                          isCurrent={lesson.id === currentLessonId}
                          lessonBaseUrl={lessonBaseUrl}
                          onPreviewLesson={onPreviewLesson}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Lesson Row Sub-Component ──────────────────────────────────────────────

function LessonRow({
  lesson,
  mode,
  isCompleted,
  isCurrent,
  lessonBaseUrl,
  onPreviewLesson,
}: {
  lesson: PublicLesson;
  mode: "storefront" | "learning";
  isCompleted: boolean;
  isCurrent: boolean;
  lessonBaseUrl: string;
  onPreviewLesson?: (lesson: PublicLesson) => void;
}) {
  const Icon = TYPE_ICON[lesson.lesson_type] || Video;
  const iconColor = TYPE_COLOR[lesson.lesson_type] || "text-slate-400";

  const content = (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
        isCurrent
          ? "bg-indigo-500/20 border border-indigo-500/30"
          : "hover:bg-slate-700/30"
      }`}
    >
      {/* Completion indicator or type icon */}
      {mode === "learning" ? (
        isCompleted ? (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
        ) : (
          <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-600" />
        )
      ) : lesson.is_free_preview ? (
        <PlayCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
      ) : (
        <Lock className="h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
      )}

      {/* Type icon + Title */}
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          isCurrent
            ? "font-semibold text-indigo-300"
            : isCompleted
              ? "text-slate-400 line-through"
              : "text-slate-300"
        }`}
      >
        {lesson.title}
      </span>

      {/* Duration */}
      {lesson.video_duration > 0 && (
        <span className="flex-shrink-0 text-[11px] text-slate-500">
          {Math.ceil(lesson.video_duration / 60)} phút
        </span>
      )}

      {/* Free preview badge (storefront only) */}
      {mode === "storefront" && lesson.is_free_preview && (
        <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          Xem thử
        </span>
      )}
    </div>
  );

  // Storefront mode: clickable only if free preview
  if (mode === "storefront") {
    if (lesson.is_free_preview && onPreviewLesson) {
      return (
        <button
          type="button"
          className="w-full"
          onClick={() => onPreviewLesson(lesson)}
        >
          {content}
        </button>
      );
    }
    return <div>{content}</div>;
  }

  // Learning mode: always a link
  return (
    <Link href={`${lessonBaseUrl}/${lesson.id}`} className="block">
      {content}
    </Link>
  );
}
