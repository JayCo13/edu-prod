import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import OnboardingClient from "./OnboardingClient";

/**
 * Server-component wrapper for /onboarding.
 *
 * Trước khi mount form, kiểm tra xem user đã có tenant chưa:
 *   • Là owner của một tenant (tenants.owner_id = user.id)
 *   • Hoặc là teacher slot active trong tenant nào đó
 *   • Hoặc là student gắn với tenant qua profiles.tenant_id
 *
 * Bất kỳ trường hợp nào → đi thẳng /dashboard. Loại bỏ vòng lặp
 * "tạo tenant xong nhưng dashboard bounce ngược về onboarding": kể cả
 * dashboard layout vì lý do gì đó không thấy tenant, server-side check
 * ở đây sẽ thấy (dùng admin client bypass RLS) và đẩy forward.
 *
 * Không có auth → đẩy về /login (cùng pattern với admin layout).
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Dùng admin client để tránh mọi rủi ro RLS edge case khi đọc các
  // bảng tenant. Chỉ check tồn tại (không expose dữ liệu nhạy cảm).
  const admin = createAdminClient();
  const [{ data: ownedTenant }, { data: teacherSlot }, { data: profile }] =
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

  if (ownedTenant || teacherSlot || isStudentInTenant) {
    redirect("/dashboard");
  }

  return <OnboardingClient />;
}
