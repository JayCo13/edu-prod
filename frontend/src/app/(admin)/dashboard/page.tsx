import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/modules/dashboard/AdminDashboard";
import SchoolDashboard from "@/modules/dashboard/SchoolDashboard";
import TeacherDashboard from "@/modules/dashboard/TeacherDashboard";
import { resolveDashboardRole } from "@/modules/dashboard/resolveDashboardRole";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

/**
 * /dashboard — role-routed entry point (PRD §8.2).
 *
 * Routing matrix (kind × role):
 *   CENTER + admin  → AdminDashboard  (payroll, sessions, todos)
 *   SCHOOL + admin  → SchoolDashboard (TKB, classes, teachers, no payroll)
 *   any   + teacher → TeacherDashboard
 *
 * Tenant kind comes from migration 0031 (`tenants.kind`). Falls back to
 * CENTER if the context lookup fails so existing tenants stay on the
 * legacy dashboard.
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
  if (role !== "admin") {
    return <TeacherDashboard userName={userName} />;
  }

  // Admin path: pick CENTER vs SCHOOL dashboard by tenant kind.
  const ctx = await getCurrentTenantContext().catch(() => null);
  const kind = ctx?.tenant.kind ?? "CENTER";

  return kind === "SCHOOL" ? (
    <SchoolDashboard userName={userName} />
  ) : (
    <AdminDashboard userName={userName} />
  );
}
