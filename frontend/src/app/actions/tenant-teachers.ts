"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendWhiteLabelEmail,
  teacherCredentialsEmailContent,
} from "@/lib/email/sender";
import type {
  ActionResult,
  TeacherRoleRow,
  TenantTeacherRow,
} from "@/types/database";

/** Window during which a freshly-created teacher can self-change their
 *  temp password. After this, /auth/change-password locks them out. */
const PASSWORD_CHANGE_WINDOW_HOURS = 24;

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

const PAYMENT_STRUCTURE = z.enum([
  "HOURLY",
  "PER_SESSION",
  "FIXED_MONTHLY",
  "HYBRID",
]);

const NON_NEG_VND = z
  .number()
  .int("Số tiền phải là số nguyên")
  .min(0, "Số tiền không được âm")
  .max(999_999_999, "Số tiền quá lớn");

// Email + password are optional to support the SCHOOL "lite" flow: the
// admin just records a teacher as a label (for timetable assignment) —
// no auth account, no invitation email. When both are present we run the
// full CENTER flow (create auth user + send credentials email).
const createTeacherSchema = z.object({
  display_name: z.string().min(1, "Tên giáo viên không được để trống").max(100),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
    .max(72, "Mật khẩu quá dài")
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .regex(COLOR_HEX, "Mã màu không hợp lệ (ví dụ: #4F46E5)")
    .default("#6366F1"),
  is_admin: z.boolean().default(false),
  // Payment fields — all optional at create (admin fills later if not ready).
  payment_structure: PAYMENT_STRUCTURE.default("HOURLY"),
  hourly_rate: NON_NEG_VND.default(0),
  per_session_rate: NON_NEG_VND.nullable().optional(),
  fixed_monthly_amount: NON_NEG_VND.nullable().optional(),
  tax_id: z.string().max(20).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
});

// Update flow doesn't touch the auth account, so email/password stay out.
const updateTeacherSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  color: z.string().regex(COLOR_HEX).optional(),
  is_admin: z.boolean().optional(),
  is_active: z.boolean().optional(),
  payment_structure: PAYMENT_STRUCTURE.optional(),
  hourly_rate: NON_NEG_VND.optional(),
  per_session_rate: NON_NEG_VND.nullable().optional(),
  fixed_monthly_amount: NON_NEG_VND.nullable().optional(),
  tax_id: z.string().max(20).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

/** Resolve the absolute origin (https://app.example.com) of the current
 *  request — used to build the change-password URL emailed to the teacher. */
async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Find an existing auth user by email (case-insensitive). Returns the user
 *  id if a match exists, otherwise null. Uses the service-role client. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  // listUsers is paginated. For B2B education centers, a single page is
  // overwhelmingly enough; we cap at the first 1000 users.
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return null;
  const needle = email.trim().toLowerCase();
  const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === needle);
  return hit?.id ?? null;
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
  /** Product face — affects sidebar nav and copy. Migration 0031.
   *  CENTER = trung tâm (payroll-first), SCHOOL = trường học (timetable-first). */
  kind: "CENTER" | "SCHOOL";
}

export async function getCurrentTenantContextForClient(): Promise<
  ActionResult<ClientTenantContext>
> {
  try {
    const { tenant, currentTeacherId, isAdmin } =
      await getCurrentTenantContext();
    return {
      success: true,
      data: {
        tenantId: tenant.id,
        currentTeacherId,
        isAdmin,
        kind: tenant.kind ?? "CENTER",
      },
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

    const rawEmail = parsed.data.email?.trim() ?? "";
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const password = parsed.data.password?.trim() ?? "";
    const displayName = parsed.data.display_name.trim();

    // Lite mode (SCHOOL or admins who don't want to invite yet): no email →
    // skip auth user creation + skip credential email. profile_id stays NULL;
    // the slot can still be assigned to timetable rows and edited later.
    const liteMode = !email || !password;

    // Resolve / create the auth user this teacher row will link to. Skipped
    // entirely in lite mode.
    let profileId: string | null = null;
    let isNewAccount = false;
    const deadlineIso = new Date(
      Date.now() + PASSWORD_CHANGE_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();

    if (!liteMode && email) {
      try {
        profileId = await findUserIdByEmail(email);
      } catch {
        profileId = null;
      }

      if (!profileId) {
        const admin = createAdminClient();
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              display_name: displayName,
              invited_to_tenant: tenant.id,
              must_change_password: true,
              password_change_deadline: deadlineIso,
            },
          });
        if (createErr || !created.user) {
          return {
            success: false,
            error:
              createErr?.message ?? "Không tạo được tài khoản giáo viên.",
          };
        }
        profileId = created.user.id;
        isNewAccount = true;
      }
    }

    const { data, error } = await supabase
      .from("tenant_teachers")
      .insert({
        tenant_id: tenant.id,
        profile_id: profileId,
        display_name: displayName,
        email,
        color: parsed.data.color.toUpperCase(),
        is_admin: parsed.data.is_admin,
        payment_structure: parsed.data.payment_structure,
        hourly_rate: parsed.data.hourly_rate,
        per_session_rate: parsed.data.per_session_rate ?? null,
        fixed_monthly_amount: parsed.data.fixed_monthly_amount ?? null,
        tax_id: parsed.data.tax_id?.trim() || null,
        role_id: parsed.data.role_id ?? null,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    // Email the new teacher their credentials + change-password CTA.
    // Skipped in lite mode. Don't fail the whole flow on email errors —
    // surface as a warning so the admin knows to share the password manually.
    let emailWarning: string | null = null;
    if (isNewAccount && email) {
      try {
        const origin = await getRequestOrigin();
        const emailResult = await sendWhiteLabelEmail({
          to: email,
          subject: `Tài khoản giáo viên - ${tenant.name}`,
          tenantName: tenant.name,
          tenantLogo: tenant.logo_url ?? null,
          htmlContent: teacherCredentialsEmailContent({
            displayName,
            loginEmail: email,
            tempPassword: password,
            changePasswordUrl: `${origin}/auth/change-password`,
            tenantName: tenant.name,
          }),
        });
        if (!emailResult.success) {
          emailWarning = `Không gửi được email cho giáo viên: ${emailResult.error ?? "lỗi không xác định"}`;
        }
      } catch (e) {
        emailWarning =
          e instanceof Error
            ? `Không gửi được email cho giáo viên: ${e.message}`
            : "Không gửi được email cho giáo viên.";
      }
    }

    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      data: data as TenantTeacherRow,
      ...(emailWarning ? { warning: emailWarning } : {}),
    };
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
    if (parsed.data.payment_structure !== undefined)
      patch.payment_structure = parsed.data.payment_structure;
    if (parsed.data.hourly_rate !== undefined)
      patch.hourly_rate = parsed.data.hourly_rate;
    if (parsed.data.per_session_rate !== undefined)
      patch.per_session_rate = parsed.data.per_session_rate;
    if (parsed.data.fixed_monthly_amount !== undefined)
      patch.fixed_monthly_amount = parsed.data.fixed_monthly_amount;
    if (parsed.data.tax_id !== undefined)
      patch.tax_id = parsed.data.tax_id?.trim() || null;

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

// ─── Teacher Roles (migration 0032) ──────────────────────────────────────

const COLOR_HEX_OPT = z
  .string()
  .regex(COLOR_HEX, "Mã màu không hợp lệ (ví dụ: #4F46E5)")
  .optional();

const roleCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên vai trò không được trống").max(80),
  short_code: z.string().trim().max(8).default(""),
  color: COLOR_HEX_OPT.default("#64748B"),
  sort_order: z.number().int().min(0).max(9999).default(100),
});

const roleUpdateSchema = roleCreateSchema.partial();

/** List all roles in the current tenant, sorted by sort_order then name. */
export async function listTeacherRoles(): Promise<
  ActionResult<TeacherRoleRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("teacher_roles")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TeacherRoleRow[] };
  } catch (err) {
    return handleError<TeacherRoleRow[]>(err);
  }
}

export async function createTeacherRole(
  input: z.infer<typeof roleCreateSchema>,
): Promise<ActionResult<TeacherRoleRow>> {
  try {
    const parsed = roleCreateSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message };
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên mới có thể quản lý vai trò.",
      };
    }
    const { data, error } = await supabase
      .from("teacher_roles")
      .insert({
        tenant_id: tenant.id,
        name: parsed.data.name.trim(),
        short_code: parsed.data.short_code.trim().toUpperCase(),
        color: parsed.data.color!.toUpperCase(),
        sort_order: parsed.data.sort_order,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    return { success: true, data: data as TeacherRoleRow };
  } catch (err) {
    return handleError<TeacherRoleRow>(err);
  }
}

export async function updateTeacherRole(
  id: string,
  input: z.infer<typeof roleUpdateSchema>,
): Promise<ActionResult<TeacherRoleRow>> {
  try {
    const parsed = roleUpdateSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message };
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên mới có thể quản lý vai trò.",
      };
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
    if (parsed.data.short_code !== undefined)
      patch.short_code = parsed.data.short_code.trim().toUpperCase();
    if (parsed.data.color !== undefined)
      patch.color = parsed.data.color.toUpperCase();
    if (parsed.data.sort_order !== undefined)
      patch.sort_order = parsed.data.sort_order;
    const { data, error } = await supabase
      .from("teacher_roles")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    return { success: true, data: data as TeacherRoleRow };
  } catch (err) {
    return handleError<TeacherRoleRow>(err);
  }
}

export async function deleteTeacherRole(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên mới có thể quản lý vai trò.",
      };
    }
    const { error } = await supabase
      .from("teacher_roles")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// Canonical Vietnamese school + center roles. Used by `seedStandardTeacherRoles`
// to populate a brand-new tenant. Centers and schools get slightly different
// defaults — the tenant kind decides which list to seed.
const STANDARD_ROLES_SCHOOL = [
  { name: "Hiệu trưởng", short_code: "HT", color: "#7C3AED", sort_order: 10 },
  { name: "Phó hiệu trưởng", short_code: "PHT", color: "#9333EA", sort_order: 20 },
  { name: "Tổ trưởng chuyên môn", short_code: "TT", color: "#0EA5E9", sort_order: 30 },
  { name: "Giáo viên chủ nhiệm", short_code: "GVCN", color: "#10B981", sort_order: 40 },
  { name: "Giáo viên bộ môn", short_code: "GV", color: "#64748B", sort_order: 50 },
  { name: "Giáo vụ", short_code: "GVU", color: "#F59E0B", sort_order: 60 },
] as const;

const STANDARD_ROLES_CENTER = [
  { name: "Quản lý trung tâm", short_code: "QL", color: "#7C3AED", sort_order: 10 },
  { name: "Trưởng bộ môn", short_code: "TBM", color: "#0EA5E9", sort_order: 20 },
  { name: "Giáo viên", short_code: "GV", color: "#64748B", sort_order: 30 },
  { name: "Trợ giảng", short_code: "TG", color: "#10B981", sort_order: 40 },
  { name: "Tư vấn / Cố vấn học tập", short_code: "TV", color: "#F59E0B", sort_order: 50 },
] as const;

export interface SeedRolesResult {
  created: TeacherRoleRow[];
  skipped: string[];
}

/** Bulk-insert standard roles for the tenant's product face (kind). Idempotent:
 *  any role whose name already exists is skipped. */
export async function seedStandardTeacherRoles(): Promise<
  ActionResult<SeedRolesResult>
> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên mới có thể seed vai trò mặc định.",
      };
    }

    const kind = tenant.kind ?? "CENTER";
    const list =
      kind === "SCHOOL" ? STANDARD_ROLES_SCHOOL : STANDARD_ROLES_CENTER;

    const { data: existingRows, error: readErr } = await supabase
      .from("teacher_roles")
      .select("name")
      .eq("tenant_id", tenant.id);
    if (readErr) return { success: false, error: readErr.message };

    const existing = new Set(
      (existingRows ?? []).map((r) => r.name.toLowerCase()),
    );
    const toInsert = list.filter((r) => !existing.has(r.name.toLowerCase()));
    const skipped = list
      .filter((r) => existing.has(r.name.toLowerCase()))
      .map((r) => r.name);

    if (toInsert.length === 0) {
      revalidatePath("/dashboard/teachers");
      return { success: true, data: { created: [], skipped } };
    }

    const payload = toInsert.map((r) => ({
      tenant_id: tenant.id,
      name: r.name,
      short_code: r.short_code,
      color: r.color,
      sort_order: r.sort_order,
    }));
    const { data, error } = await supabase
      .from("teacher_roles")
      .insert(payload)
      .select();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/teachers");
    return {
      success: true,
      data: { created: (data ?? []) as TeacherRoleRow[], skipped },
    };
  } catch (err) {
    return handleError<SeedRolesResult>(err);
  }
}
