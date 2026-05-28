/**
 * Server-only helper that resolves the active tenant for the current user,
 * supporting BOTH paths into a tenant:
 *   1. Tenant owner (tenants.owner_id = auth.uid()) — always admin.
 *   2. Linked tenant teacher slot (tenant_teachers.profile_id = auth.uid()).
 *
 * Returns enough context for callers to decide what they're allowed to do
 * (isAdmin, currentTeacherId) without re-querying.
 *
 * Throws "Unauthorized" / "NoTenant" so existing handleError paths render a
 * sensible message.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantRow } from "@/types/database";

export interface TenantContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenant: TenantRow;
  userId: string;
  /** tenant_teachers.id matching auth.uid() in this tenant. NULL = unlinked owner. */
  currentTeacherId: string | null;
  /** True when the caller is the tenant owner OR a teacher slot with is_admin=true. */
  isAdmin: boolean;
}

export async function getCurrentTenantContext(): Promise<TenantContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  // Path 1: caller owns the tenant.
  const { data: ownedTenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownedTenant) {
    const tenant = ownedTenant as TenantRow;
    // Find the owner's auto-backfilled tenant_teachers row (if migration ran).
    const { data: ownerSlot } = await supabase
      .from("tenant_teachers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("profile_id", user.id)
      .maybeSingle();
    return {
      supabase,
      tenant,
      userId: user.id,
      currentTeacherId: ownerSlot?.id ?? null,
      isAdmin: true,
    };
  }

  // Path 2: caller is a teacher in someone else's tenant.
  //
  // The user-scoped client can't reliably read the slot here: the
  // tenant_teachers SELECT policy delegates to public.current_tenant_teacher_id,
  // which (before migration 0020) recursively re-enters the same policy and
  // never resolves for a non-admin. Use the service-role client just to
  // resolve the user → slot/tenant binding; downstream queries still go
  // through the user-scoped client so RLS continues to gate every read.
  const admin = createAdminClient();
  const { data: slot } = await admin
    .from("tenant_teachers")
    .select("id, tenant_id, is_admin, tenant:tenants!tenant_teachers_tenant_id_fkey(*)")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!slot || !slot.tenant) throw new Error("NoTenant");

  return {
    supabase,
    tenant: slot.tenant as unknown as TenantRow,
    userId: user.id,
    currentTeacherId: slot.id,
    isAdmin: slot.is_admin,
  };
}
