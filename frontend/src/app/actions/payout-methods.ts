"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ActionResult,
  TeacherPayoutMethodRow,
} from "@/types/database";

/**
 * Teacher payout methods — server actions.
 *
 * RLS does the heavy auth work (migration 0026); these wrappers just
 * validate input, look up the caller's tenant_teachers.id, and return
 * Vietnamese error messages.
 *
 * QR images live in the private Supabase Storage bucket `payout-qr`. The
 * teacher's browser uploads directly to it via the supabase JS client; we
 * only persist the storage path on the row. Display side uses signed URLs
 * minted by `getQrSignedUrl()` below.
 */

const QR_BUCKET = "payout-qr";

// ── Validation ────────────────────────────────────────────────────────────

const VN_BANK_RE = /^[\w\s\-.,()&/]+$/;
const ACCOUNT_RE = /^[0-9\s-]+$/;

const createSchema = z.object({
  bank_name: z
    .string()
    .trim()
    .min(2, "Tên ngân hàng phải có ít nhất 2 ký tự")
    .max(120)
    .regex(VN_BANK_RE, "Tên ngân hàng chứa ký tự không hợp lệ"),
  account_number: z
    .string()
    .trim()
    .min(6, "Số tài khoản quá ngắn")
    .max(40, "Số tài khoản quá dài")
    .regex(ACCOUNT_RE, "Số tài khoản chỉ chứa số, dấu cách hoặc gạch ngang"),
  account_holder: z
    .string()
    .trim()
    .min(2, "Tên chủ tài khoản phải có ít nhất 2 ký tự")
    .max(120),
  qr_image_path: z.string().max(500).optional().nullable(),
  is_primary: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  is_active: z.boolean().optional(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

// ── Resolve caller's tenant_teachers.id ───────────────────────────────────

/** Resolve the user's first active tenant_teachers slot directly — NOT via
 *  getCurrentTenantContext, which short-circuits on Path 1 ("owns tenant")
 *  and returns currentTeacherId=null when the owner has no slot in their
 *  OWN tenant. The user may still teach (and want a payout method) in
 *  another tenant they're a member of. Admin client bypasses the
 *  recursive RLS read on tenant_teachers. */
async function requireTeacherSlot(): Promise<
  | { ok: true; tenantId: string; teacherId: string }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Phiên đã hết hạn." };
    }
    const admin = createAdminClient();
    const { data: slot } = await admin
      .from("tenant_teachers")
      .select("id, tenant_id")
      .eq("profile_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!slot) {
      return {
        ok: false,
        error: "Tài khoản của bạn chưa được gắn với trung tâm nào.",
      };
    }
    return { ok: true, tenantId: slot.tenant_id, teacherId: slot.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Phiên đã hết hạn.";
    return { ok: false, error: msg };
  }
}

// ── READ: teacher's own methods ───────────────────────────────────────────

export async function listMyPayoutMethods(): Promise<
  ActionResult<TeacherPayoutMethodRow[]>
> {
  try {
    const ctx = await requireTeacherSlot();
    if (!ctx.ok) return { success: false, error: ctx.error };
    // Admin client because the user-scoped RLS subquery on tenant_teachers
    // can fail when migration 0020 (SECURITY DEFINER helpers) hasn't been
    // applied. requireTeacherSlot already proved this teacher_id belongs
    // to the authenticated user, so scoping by it is the auth check.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teacher_payout_methods")
      .select("*")
      .eq("teacher_id", ctx.teacherId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TeacherPayoutMethodRow[] };
  } catch (err) {
    return handleError(err);
  }
}

// ── READ: admin pulls a teacher's primary method for the payout screen ───

export async function getPrimaryPayoutMethodForTeacher(
  teacherId: string,
): Promise<ActionResult<TeacherPayoutMethodRow | null>> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới xem được tài khoản giáo viên.",
      };
    }
    const { data, error } = await supabase
      .from("teacher_payout_methods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", teacherId)
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? null) as TeacherPayoutMethodRow | null };
  } catch (err) {
    return handleError(err);
  }
}

// ── WRITE: create ─────────────────────────────────────────────────────────

export async function createMyPayoutMethod(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<TeacherPayoutMethodRow>> {
  try {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const ctx = await requireTeacherSlot();
    if (!ctx.ok) return { success: false, error: ctx.error };
    const admin = createAdminClient();

    // If this row is set primary, unset the existing primary first so the
    // partial unique index doesn't reject the insert.
    if (parsed.data.is_primary !== false) {
      await admin
        .from("teacher_payout_methods")
        .update({ is_primary: false })
        .eq("teacher_id", ctx.teacherId)
        .eq("is_primary", true);
    }

    const { data, error } = await admin
      .from("teacher_payout_methods")
      .insert({
        tenant_id: ctx.tenantId,
        teacher_id: ctx.teacherId,
        bank_name: parsed.data.bank_name,
        account_number: parsed.data.account_number,
        account_holder: parsed.data.account_holder,
        qr_image_path: parsed.data.qr_image_path ?? null,
        is_primary: parsed.data.is_primary !== false,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/payouts");
    revalidatePath("/dashboard");
    return { success: true, data: data as TeacherPayoutMethodRow };
  } catch (err) {
    return handleError<TeacherPayoutMethodRow>(err);
  }
}

// ── WRITE: update ─────────────────────────────────────────────────────────

export async function updateMyPayoutMethod(
  id: string,
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult<TeacherPayoutMethodRow>> {
  try {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const ctx = await requireTeacherSlot();
    if (!ctx.ok) return { success: false, error: ctx.error };
    const admin = createAdminClient();

    if (parsed.data.is_primary === true) {
      await admin
        .from("teacher_payout_methods")
        .update({ is_primary: false })
        .eq("teacher_id", ctx.teacherId)
        .eq("is_primary", true)
        .neq("id", id);
    }

    const patch: Record<string, unknown> = {};
    for (const k of [
      "bank_name",
      "account_number",
      "account_holder",
      "qr_image_path",
      "is_primary",
      "is_active",
    ] as const) {
      if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
    }

    const { data, error } = await admin
      .from("teacher_payout_methods")
      .update(patch)
      .eq("id", id)
      .eq("teacher_id", ctx.teacherId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/payouts");
    return { success: true, data: data as TeacherPayoutMethodRow };
  } catch (err) {
    return handleError<TeacherPayoutMethodRow>(err);
  }
}

// ── WRITE: delete ─────────────────────────────────────────────────────────

export async function deleteMyPayoutMethod(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireTeacherSlot();
    if (!ctx.ok) return { success: false, error: ctx.error };
    const admin = createAdminClient();
    const { error } = await admin
      .from("teacher_payout_methods")
      .delete()
      .eq("id", id)
      .eq("teacher_id", ctx.teacherId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/payouts");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── Signed URL for QR image (admin or teacher viewing) ────────────────────
//
// Storage policies allow:
//   - The teacher reading their own file (folder == auth.uid()).
//   - Tenant admins reading files belonging to teachers in their tenant.
//
// We use the admin client to mint a short-lived signed URL because the
// user-scoped client doesn't always cooperate with cross-folder reads
// even when the policy would allow them. The actual auth check happens
// before we mint — the action verifies the caller can see the row.

export async function getQrSignedUrl(
  pathInBucket: string,
): Promise<ActionResult<string>> {
  try {
    // Look up the row first to ensure RLS visibility (teacher's own or
    // tenant admin of that teacher's tenant). If the SELECT returns null,
    // we refuse to mint a URL.
    const { supabase } = await getCurrentTenantContext();
    const { data: row, error: rowErr } = await supabase
      .from("teacher_payout_methods")
      .select("id")
      .eq("qr_image_path", pathInBucket)
      .maybeSingle();
    if (rowErr) return { success: false, error: rowErr.message };
    if (!row) {
      return { success: false, error: "Không có quyền xem hình ảnh này." };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(QR_BUCKET)
      .createSignedUrl(pathInBucket, 60 * 5); // 5 minutes
    if (error || !data?.signedUrl) {
      return { success: false, error: error?.message ?? "Không tạo được URL." };
    }
    return { success: true, data: data.signedUrl };
  } catch (err) {
    return handleError<string>(err);
  }
}
