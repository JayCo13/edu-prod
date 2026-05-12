import { redirect, notFound } from "next/navigation";
import { getPublicCourseBySlug, getFirstIncompleteLessonId } from "@/app/actions/student";

/**
 * Learning Portal Entry Point (Redirect Hub)
 * ============================================
 * Route: /t/[slug]/learn/[courseSlug]
 *
 * This page acts as a "transfer station". When a student clicks
 * "Continue Learning", they land here and get auto-redirected to:
 *   1. Their last incomplete lesson (resume where they left off)
 *   2. The first lesson of Module 1 (if brand new student)
 *   3. The first lesson (if all completed — review mode)
 */

interface PageProps {
  params: Promise<{ slug: string; courseSlug: string }>;
}

export default async function LearningPortalEntryPage({ params }: PageProps) {
  const { slug, courseSlug } = await params;

  // Fetch course to get the course ID
  const courseResult = await getPublicCourseBySlug(slug, courseSlug);
  if (!courseResult.success || !courseResult.data) {
    notFound();
  }

  const course = courseResult.data;

  // Find where the student left off
  const targetLessonId = await getFirstIncompleteLessonId(course.id);

  if (!targetLessonId) {
    // No lessons at all → stay on a fallback page
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Khóa học này chưa có bài học nào.</p>
      </div>
    );
  }

  // Redirect to the target lesson
  redirect(`/learn/${courseSlug}/${targetLessonId}`);
}
