import { notFound } from "next/navigation";
import { getPublicCourseBySlug } from "@/app/actions/student";
import CourseStorefront from "./_components/CourseStorefront";

/**
 * Course Storefront Page (Server Component)
 * ==========================================
 * Route: /t/[slug]/courses/[courseSlug]
 * Public page — no auth required. Fetches published course details.
 */

interface PageProps {
  params: Promise<{ slug: string; courseSlug: string }>;
}

export default async function CourseStorefrontPage({ params }: PageProps) {
  const { slug, courseSlug } = await params;

  const result = await getPublicCourseBySlug(slug, courseSlug);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <CourseStorefront course={result.data} tenantSlug={slug} />
    </div>
  );
}
