import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/admin-shell";

/**
 * /admin/* Layout — center-scoped admin area.
 *
 * Sibling of the legacy `(admin)/` route group (which gates `/dashboard/*`
 * on the old `tenants` model). This layout gates on `user_centers`
 * membership — the new center model per PRD §5.1. Both coexist while
 * Cycle 2 unifies vocabulary.
 *
 *   1. No session → /login
 *   2. Authenticated but no center membership → /onboarding (the
 *      onboarding flow is still tenant-shaped today; PRD Phase 3 swaps it
 *      for a center-owner wizard)
 *   3. Otherwise → render AdminShell
 */
export default async function CentersAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (process.env.NODE_ENV !== "development") {
      redirect("/login");
    }
    return <AdminShell>{children}</AdminShell>;
  }

  const { data: membership } = await supabase
    .from("user_centers")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  return <AdminShell>{children}</AdminShell>;
}
