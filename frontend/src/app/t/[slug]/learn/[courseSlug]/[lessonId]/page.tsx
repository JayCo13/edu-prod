import { notFound } from "next/navigation";
import {
  getPublicCourseBySlug,
  getLessonContent,
  getCourseProgress,
  getNextLessonId,
} from "@/app/actions/student";
import LessonViewer from "./_components/LessonViewer";

/**
 * Lesson Page (Server Component)
 * ==============================
 * Route: /t/[slug]/learn/[courseSlug]/[lessonId]
 *
 * Fetches lesson content (with enrollment/preview check),
 * course structure, progress, and next lesson ID.
 */

interface PageProps {
  params: Promise<{ slug: string; courseSlug: string; lessonId: string }>;
}

export default async function LessonPage({ params }: PageProps) {
  const { slug, courseSlug, lessonId } = await params;

  // 1. Fetch course details (for sidebar curriculum)
  const courseResult = await getPublicCourseBySlug(slug, courseSlug);
  if (!courseResult.success || !courseResult.data) {
    notFound();
  }

  const course = courseResult.data;

  // 2. Fetch full lesson content (secure — checks enrollment or free preview)
  const lessonResult = await getLessonContent(lessonId, course.id);
  if (!lessonResult.success || !lessonResult.data) {
    notFound();
  }

  // 3. Fetch progress + next lesson (parallel)
  const [progressResult, nextLessonId] = await Promise.all([
    getCourseProgress(course.id),
    getNextLessonId(lessonId, course.id),
  ]);

  const lessonBaseUrl = `/learn/${courseSlug}`;

  return (
    <LessonViewer
      lesson={lessonResult.data}
      courseId={course.id}
      courseSlug={courseSlug}
      modules={course.modules}
      progress={progressResult.data || []}
      nextLessonId={nextLessonId}
      lessonBaseUrl={lessonBaseUrl}
    />
  );
}
