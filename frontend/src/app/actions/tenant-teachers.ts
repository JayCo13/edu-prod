"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ActionResult, TenantTeacherRow } from "@/types/database";

/**
 * Tenant-Teachers CRUD (admin-only mutations, member-readable list).
 *
 * - Solo teacher tenants: a single tenant_teachers row exists for the owner
 *   (auto-backfilled by migration 0012). The CalendarBoard hides the lens
 *   toggle and teacher pills when only one row is present.
 * - Center tenants: admin adds additional rows here. profile_id is OPTIONAL
 *   so a slot can exist before the teacher signs in (admin schedules for
 *   them in the meantime).
 */

const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

const createTeacherSchema = z.object({
  display_name: z.string().min(1, "Tên giáo viên không được để trống").max(100),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .nullable()
    .or(z.literal("")),
  color: z
    .string()
    .regex(COLOR_HEX, "Mã màu không hợp lệ (ví dụ: #4F46E5)")
    .default("#6366F1"),
  is_admin: z.boolean().default(false),
});

const updateTeacherSchema = createTeacherSchema.partial().extend({
  is_active: z.boolean().optional(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

// ── List ──────────────────────────────────────────────────────────────────

export async function getTenantTeachers(): Promise<
  ActionResult<TenantTeacherRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("tenant_teachers")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("is_admin", { ascending: false })
      .order("display_name", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TenantTeacherRow[] };
  } catch (err) {
    return handleError(err);
  }
}

// ── Tenant context for client UI (lens / pills) ───────────────────────────

export interface ClientTenantContext {
  tenantId: string;
  currentTeacherId: string | null;
  isAdmin: boolean;
}

export async function getCurrentTenantContextForClient(): Promise<
  ActionResult<ClientTenantContext>
> {
  try {
    const { tenant, currentTeacherId, isAdmin } =
      await getCurrentTenantContext();
    return {
      success: true,
      data: { tenantId: tenant.id, currentTeacherId, isAdmin },
    };
  } catch (err) {
    return handleError(err);
  }
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createTenantTeacher(
  input: z.infer<typeof createTeacherSchema>,
): Promise<ActionResult<TenantTeacherRow>> {
  try {
    const parsed = createTeacherSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể thêm giáo viên.",
      };
    }

    // If an email was provided, try to link an existing profile by email.
    let profileId: string | null = null;
    const email = parsed.data.email?.trim() || null;
    if (email) {
      // Look up auth.users via profiles join? In Supabase, profiles row is
      // 1:1 with auth.users, but auth.users isn't directly readable. For now
      // we accept the email as a hint and leave profile_id NULL — admin can
      // link later when the teacher signs in. (Email-based invitation is a
      // future enhancement.)
      profileId = null;
    }

    const { data, error } = await supabase
      .from("tenant_teachers")
      .insert({
        tenant_id: tenant.id,
        profile_id: profileId,
        display_name: parsed.data.display_name.trim(),
        email,
        color: parsed.data.color.toUpperCase(),
        is_admin: parsed.data.is_admin,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: data as TenantTeacherRow };
  } catch (err) {
    return handleError<TenantTeacherRow>(err);
  }
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateTenantTeacher(
  id: string,
  input: z.infer<typeof updateTeacherSchema>,
): Promise<ActionResult<TenantTeacherRow>> {
  try {
    const parsed = updateTeacherSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể chỉnh sửa giáo viên.",
      };
    }

    const patch: Partial<TenantTeacherRow> = {};
    if (parsed.data.display_name !== undefined)
      patch.display_name = parsed.data.display_name.trim();
    if (parsed.data.email !== undefined) {
      const e = parsed.data.email?.trim() || null;
      patch.email = e;
    }
    if (parsed.data.color !== undefined)
      patch.color = parsed.data.color.toUpperCase();
    if (parsed.data.is_admin !== undefined)
      patch.is_admin = parsed.data.is_admin;
    if (parsed.data.is_active !== undefined)
      patch.is_active = parsed.data.is_active;

    const { data, error } = await supabase
      .from("tenant_teachers")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: data as TenantTeacherRow };
  } catch (err) {
    return handleError<TenantTeacherRow>(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteTenantTeacher(
  id: string,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể xóa giáo viên.",
      };
    }

    // Refuse to delete the last admin — would lock the tenant.
    const target = await supabase
      .from("tenant_teachers")
      .select("is_admin")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .single();
    if (target.data?.is_admin) {
      const adminCount = await supabase
        .from("tenant_teachers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_admin", true)
        .eq("is_active", true);
      if ((adminCount.count ?? 0) <= 1) {
        return {
          success: false,
          error: "Không thể xóa quản trị viên duy nhất của trung tâm.",
        };
      }
    }

    const { error } = await supabase
      .from("tenant_teachers")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
