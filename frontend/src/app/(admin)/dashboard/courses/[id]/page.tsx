import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurriculum } from "@/app/actions/curriculum";
import type { CourseRow } from "@/types/database";
import CurriculumBuilder from "./_components/CurriculumBuilder";

/**
 * Course Detail Page (Server Component)
 * =======================================
 * Fetches course info + curriculum data server-side,
 * then renders the CurriculumBuilder client component.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id: courseId } = await params;

  const supabase = await createClient();

  // ── Fetch course ────────────────────────────────────────────
  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    notFound();
  }

  // ── Fetch curriculum ────────────────────────────────────────
  const curriculumResult = await getCurriculum(courseId);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">
          Quản lý khóa học
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {(course as CourseRow).title}
        </h1>
      </div>

      {/* Curriculum Builder */}
      <CurriculumBuilder
        courseId={courseId}
        initialModules={curriculumResult.data || []}
      />
    </div>
  );
}
