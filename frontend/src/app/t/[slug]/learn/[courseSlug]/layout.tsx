import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getPublicCourseBySlug } from "@/app/actions/student";
import { getCourseProgress } from "@/app/actions/student";

/**
 * Learning Portal Layout
 * ======================
 * Full-screen immersive layout (100vh) — hides global header/footer.
 * Features:
 *   - Custom top bar with back button, course title, progress bar
 *   - Children rendered below in the remaining viewport
 */

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string; courseSlug: string }>;
}

export default async function LearningPortalLayout({
  children,
  params,
}: LayoutProps) {
  const { slug, courseSlug } = await params;

  // Fetch course data for the header
  const courseResult = await getPublicCourseBySlug(slug, courseSlug);
  if (!courseResult.success || !courseResult.data) {
    notFound();
  }

  const course = courseResult.data;
  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0,
  );

  // Fetch progress
  const progressResult = await getCourseProgress(course.id);
  const completedCount =
    progressResult.data?.filter((p) => p.is_completed).length || 0;
  const progressPct =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* ── Top Bar ──────────────────────────────────── */}
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
        {/* Back */}
        <Link
          href={`/courses/${courseSlug}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Quay lại</span>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-700" />

        {/* Course Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BookOpen className="h-4 w-4 flex-shrink-0 text-indigo-400" />
          <p className="truncate text-sm font-medium text-slate-200">
            {course.title}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-xs text-slate-400">
            {completedCount}/{totalLessons} bài
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800 sm:w-32">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-indigo-400">
            {progressPct}%
          </span>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
