/**
 * resolveDashboardRole — picks AdminDashboard vs TeacherDashboard.
 *
 * Aware of BOTH schema cycles:
 *   1. New (Cycle 1): user_centers.role_in_center via resolveCenterId()
 *   2. Legacy (pre-pivot): tenants.owner_id + tenant_teachers.is_admin
 *
 * Falls through legacy when no center membership exists yet so existing
 * users keep working until Cycle 2 unifies vocabulary. Defaults to
 * "teacher" — the safer view (less surface area) for an unrecognized
 * caller.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";

export type DashboardRole = "admin" | "teacher";

export async function resolveDashboardRole(): Promise<DashboardRole> {
  // Path 1 — new center model.
  const resolved = await resolveCenterId();
  if (resolved.ok) {
    return resolved.role === "TEACHER" ? "teacher" : "admin";
  }

  // Path 2 — legacy fallback. /dashboard sits under (admin)/layout, which
  // has already verified the user owns a tenant OR fills an active teacher
  // slot OR is a tenant-attached student. Distinguish admin vs teacher
  // based on the legacy ownership/admin bits.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "teacher";

  const { data: ownedTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (ownedTenant) return "admin";

  const { data: slot } = await supabase
    .from("tenant_teachers")
    .select("is_admin")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (slot?.is_admin) return "admin";

  return "teacher";
}
