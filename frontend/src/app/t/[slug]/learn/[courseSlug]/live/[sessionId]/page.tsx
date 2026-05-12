import { notFound } from "next/navigation";
import { getStudentLiveSession } from "@/app/actions/live-sessions";
import { getPublicCourseBySlug } from "@/app/actions/student";
import WaitingRoom from "./_components/WaitingRoom";

/**
 * Live Session Waiting Room (Server Component)
 * =============================================
 * Route: /t/[slug]/learn/[courseSlug]/live/[sessionId]
 *
 * Fetches session data server-side (enrollment check via RLS),
 * then renders the WaitingRoom client component.
 */

interface PageProps {
  params: Promise<{ slug: string; courseSlug: string; sessionId: string }>;
}

export default async function LiveSessionPage({ params }: PageProps) {
  const { slug, courseSlug, sessionId } = await params;

  // Fetch course for metadata
  const courseResult = await getPublicCourseBySlug(slug, courseSlug);
  if (!courseResult.success || !courseResult.data) {
    notFound();
  }

  const course = courseResult.data;

  // Fetch session (RLS enforces enrollment check)
  const sessionResult = await getStudentLiveSession(sessionId, course.id);
  if (!sessionResult.success || !sessionResult.data) {
    notFound();
  }

  return (
    <WaitingRoom
      session={sessionResult.data}
      courseSlug={courseSlug}
      courseName={course.title}
    />
  );
}
