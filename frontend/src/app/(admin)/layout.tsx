import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/admin-shell";

/**
 * Admin Layout (Server Component — Gatekeeper)
 * =============================================
 * Interceptor pattern:
 *   1. No session → redirect to /login
 *   2. Teacher without tenant → redirect to /onboarding
 *   3. Otherwise → render AdminShell with children
 *
 * This runs on every /dashboard/* request.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  // ── Auth Check ──────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dev affordance: when Supabase is unreachable in development, allow
  // unauthenticated access so the dashboard UI can be reviewed without
  // a working DB. Production strictly redirects to /login.
  if (!user) {
    if (process.env.NODE_ENV !== "development") {
      redirect("/login");
    }
    return <AdminShell>{children}</AdminShell>;
  }

  // ── Onboarding Check (must have a tenant to access dashboard) ──
  // Multiple ways to legitimately reach the dashboard:
  //   1. You own a tenant (tenants.owner_id = you) — solo teacher / center admin
  //   2. You're a teacher slot in someone else's tenant (tenant_teachers.profile_id = you)
  //   3. You're a student attached to a tenant (profiles.role = 'student' + tenant_id)
  // Otherwise → /onboarding to create a tenant.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!tenant) {
    // Use the service-role client for the teacher-slot probe — the user-
    // scoped client can't reliably read tenant_teachers for non-admins
    // (the SELECT policy recurses through public.current_tenant_teacher_id
    // before migration 0020). We're only checking "does a slot exist for
    // this user.id", which is the same bit the policy ultimately exposes.
    const admin = createAdminClient();
    const [{ data: teacherSlot }, { data: profile }] = await Promise.all([
      admin
        .from("tenant_teachers")
        .select("id")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const isStudentInTenant =
      profile?.role === "student" && !!profile?.tenant_id;

    if (!teacherSlot && !isStudentInTenant) {
      redirect("/onboarding");
    }
  }

  return <AdminShell>{children}</AdminShell>;
}
