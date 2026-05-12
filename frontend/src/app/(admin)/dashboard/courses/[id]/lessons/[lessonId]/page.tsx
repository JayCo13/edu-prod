import { notFound } from "next/navigation";
import { getLessonById } from "@/app/actions/curriculum";
import LessonEditor from "./_components/LessonEditor";

/**
 * Lesson Editor Page (Server Component)
 * =======================================
 * Route: /dashboard/courses/[id]/lessons/[lessonId]
 *
 * Fetches lesson data server-side with ownership verification,
 * then renders the dynamic LessonEditor client component.
 */

interface PageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonEditorPage({ params }: PageProps) {
  const { id: courseId, lessonId } = await params;

  const result = await getLessonById(lessonId, courseId);

  if (!result.success || !result.data) {
    notFound();
  }

  return <LessonEditor lesson={result.data} courseId={courseId} />;
}
