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
  //
  // Toàn bộ existence-checks dưới đây dùng admin (service-role) client để
  // bypass mọi RLS edge case — chúng ta chỉ check "user này có quan hệ
  // nào với một tenant không", không expose dữ liệu nhạy cảm. Trước đây
  // tenant lookup dùng user-scoped client có thể trả null khi vừa tạo
  // xong tenant (timing / cache), khiến vòng lặp tạo-xong-quay-lại-/onboarding.
  const admin = createAdminClient();
  const [{ data: tenant }, { data: teacherSlot }, { data: profile }] =
    await Promise.all([
      admin
        .from("tenants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle(),
      admin
        .from("tenant_teachers")
        .select("id")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const isStudentInTenant =
    profile?.role === "student" && !!profile?.tenant_id;

  if (!tenant && !teacherSlot && !isStudentInTenant) {
    redirect("/onboarding");
  }

  return <AdminShell>{children}</AdminShell>;
}
