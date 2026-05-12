import { createClient } from "@/lib/supabase/server";
import DashboardGrid from "@/components/admin/dashboard-grid";

/**
 * Dashboard Page (Server Component)
 *
 * TODO PRD §8.2: split into AdminDashboard / TeacherDashboard. Course stats
 * widget is a placeholder pending the refactor — the LMS module is out of
 * scope per PRD §4.3.
 */

// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// import { getCourseStats } from "@/app/actions/courses";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  // Placeholder until DashboardGrid is split per PRD §8.2.
  const courseStats = { total: 0, published: 0, draft: 0 };

  return (
    <DashboardGrid
      userName={userName}
      courseStats={courseStats}
    />
  );
}
