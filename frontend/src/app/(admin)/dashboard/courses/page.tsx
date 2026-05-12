import { getCourses } from "@/app/actions/courses";
import CourseDataTable from "@/components/admin/course-data-table";

/**
 * Courses Page (Server Component)
 * ================================
 * Fetches teacher's courses via Server Action, then passes data
 * to the CourseDataTable client component for interactive UI.
 *
 * Because this is a Server Component:
 *   - getCourses() runs on the server with full cookie access
 *   - No client-side fetch waterfall
 *   - Data is streamed as HTML (fast TTFB)
 */
export default async function CoursesPage() {
  const result = await getCourses();

  return (
    <div className="mx-auto max-w-6xl">
      <CourseDataTable courses={result.data || []} />
    </div>
  );
}
