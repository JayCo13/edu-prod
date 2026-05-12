import { createClient } from "@/lib/supabase/server";
import { getCourseStats } from "@/app/actions/courses";
import DashboardGrid from "@/components/admin/dashboard-grid";

/**
 * Dashboard Page (Server Component)
 * ==================================
 * Fetches real data server-side, passes to animated Client Component.
 *
 * Data sources:
 *   - User name: supabase.auth.getUser()
 *   - Course stats: getCourseStats() action
 *   - Revenue/Students: hardcoded (Phase 2 — future)
 */

export default async function DashboardPage() {
  const supabase = await createClient();

  // ── Fetch user name ─────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Giáo viên";

  // ── Fetch course stats ──────────────────────────────────────
  const statsResult = await getCourseStats();
  const courseStats = statsResult.data || { total: 0, published: 0, draft: 0 };

  return (
    <DashboardGrid
      userName={userName}
      courseStats={courseStats}
    />
  );
}
