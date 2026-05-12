"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ProfileLayoutSchema, type ProfileLayout } from "@/lib/profile-schema";
import { DEFAULT_LAYOUT } from "@/_deprecated/components/profile/_sample";

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function getOwnerTenant(): Promise<
  Result<{
    supabase: Awaited<ReturnType<typeof createClient>>;
    tenantId: string;
  }>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Chưa đăng nhập." };

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (error || !tenant) {
      return { success: false, error: "Bạn chưa có học viện." };
    }
    return { success: true, data: { supabase, tenantId: tenant.id } };
  } catch {
    return { success: false, error: "Không thể kết nối. Vui lòng thử lại." };
  }
}

// ── Read: aggregated public stats for a tenant ─────────────────────────────

export interface TenantPublicStats {
  studentCount: number;
  courseCount: number;
  joinedAt: string | null; // ISO timestamp; null if unknown
}

export async function getTenantPublicStats(
  tenantId: string,
): Promise<Result<TenantPublicStats>> {
  try {
    const supabase = await createClient();

    // Sum enrollments + count published courses in one query.
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("enrollments_count")
      .eq("tenant_id", tenantId)
      .eq("status", "published");

    if (coursesError) return { success: false, error: coursesError.message };

    const studentCount = (courses ?? []).reduce(
      (sum, c: { enrollments_count: number | null }) =>
        sum + (c.enrollments_count ?? 0),
      0,
    );
    const courseCount = courses?.length ?? 0;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("created_at")
      .eq("id", tenantId)
      .single();

    return {
      success: true,
      data: {
        studentCount,
        courseCount,
        joinedAt: tenant?.created_at ?? null,
      },
    };
  } catch {
    return { success: false, error: "fetch-failed" };
  }
}

// ── Read: by slug (used by public tenant page) ─────────────────────────────

export async function getProfileLayoutBySlug(
  slug: string,
): Promise<Result<ProfileLayout>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenants")
      .select("profile_layout")
      .eq("subdomain", slug)
      .single();

    if (error || !data?.profile_layout) {
      return { success: false, error: "no-layout" };
    }
    const parsed = ProfileLayoutSchema.safeParse(data.profile_layout);
    if (!parsed.success) return { success: false, error: "invalid-layout" };
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "fetch-failed" };
  }
}

// ── Read: current owner's layout (used by /dashboard/profile editor) ───────

export async function getMyProfileLayout(): Promise<Result<ProfileLayout>> {
  const t = await getOwnerTenant();
  if (!t.success) return t;

  const { data, error } = await t.data.supabase
    .from("tenants")
    .select("profile_layout")
    .eq("id", t.data.tenantId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data?.profile_layout) return { success: true, data: DEFAULT_LAYOUT };

  const parsed = ProfileLayoutSchema.safeParse(data.profile_layout);
  if (!parsed.success) return { success: true, data: DEFAULT_LAYOUT };
  return { success: true, data: parsed.data };
}

// ── Write: save draft ──────────────────────────────────────────────────────

export async function saveProfileDraft(
  layout: ProfileLayout,
): Promise<Result<{ savedAt: string }>> {
  const parsed = ProfileLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Layout không hợp lệ.",
    };
  }

  const t = await getOwnerTenant();
  if (!t.success) return t;

  const { error } = await t.data.supabase
    .from("tenants")
    .update({ profile_layout: parsed.data })
    .eq("id", t.data.tenantId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { savedAt: new Date().toISOString() } };
}

// ── Write: publish (same as draft for v1; future: separate published copy) ─

export async function publishProfile(
  layout: ProfileLayout,
): Promise<Result<{ savedAt: string }>> {
  const result = await saveProfileDraft(layout);
  if (result.success) {
    // Bust the public page so visitors see the new version.
    revalidatePath("/t/[slug]", "page");
  }
  return result;
}
