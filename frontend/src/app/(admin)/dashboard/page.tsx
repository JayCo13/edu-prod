import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/modules/dashboard/AdminDashboard";
import TeacherDashboard from "@/modules/dashboard/TeacherDashboard";
import { resolveDashboardRole } from "@/modules/dashboard/resolveDashboardRole";

/**
 * /dashboard — role-routed entry point (PRD §8.2).
 *
 * The (admin)/layout.tsx above us has already gated for ANY membership
 * (legacy tenants OR Cycle-1 user_centers); we just decide which view to
 * render. Real data wires in later cycles.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Bạn";

  const role = await resolveDashboardRole();

  return role === "admin" ? (
    <AdminDashboard userName={userName} />
  ) : (
    <TeacherDashboard userName={userName} />
  );
}
