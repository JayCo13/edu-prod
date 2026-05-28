"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ActionResult } from "@/types/database";

/**
 * Profile + center settings — server actions.
 *
 * Two surfaces:
 *   - updateMyProfile()  — every signed-in user. Writes `profiles` + mirrors
 *     display_name into `auth.users.user_metadata` so the top-nav greeting
 *     and any other consumer reading from JWT see the change immediately.
 *
 *   - updateMyCenter()   — tenant admin only. Mirrors writes into BOTH
 *     `tenants` (legacy storage the rest of the app still reads from) AND
 *     `centers` (new storage backing payroll). They share the same UUID
 *     per migration 0022, so this is just a fan-out.
 *
 * Avatar / logo uploads happen client-side via the Supabase Storage JS
 * client (path-scoped RLS in migration 0028). These actions only persist
 * the stored URL/path.
 */

// ── Validation ────────────────────────────────────────────────────────────

const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Tên hiển thị không được để trống")
    .max(80, "Tên hiển thị tối đa 80 ký tự"),
  /** Public URL into Supabase Storage (public_assets bucket). NULL clears. */
  avatar_url: z.string().url().max(500).nullable().optional(),
  bio: z.string().max(500).optional(),
});

const centerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên trung tâm phải có ít nhất 2 ký tự")
    .max(120, "Tên trung tâm tối đa 120 ký tự"),
  /** Public URL into Supabase Storage. */
  logo_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  description: z.string().max(2000, "Mô tả tối đa 2000 ký tự").optional(),
  address: z.string().max(300, "Địa chỉ tối đa 300 ký tự").optional(),
  /** Vietnamese phone: digits, spaces, dots, parens, +. Loose on purpose. */
  phone: z
    .string()
    .max(40)
    .regex(/^[\d\s().+\-]*$/, "Số điện thoại không hợp lệ")
    .optional(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

// ── updateMyProfile ───────────────────────────────────────────────────────

export async function updateMyProfile(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  try {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Phiên đã hết hạn." };

    const patch = {
      display_name: parsed.data.display_name,
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.avatar_url !== undefined
        ? { avatar_url: parsed.data.avatar_url ?? "" }
        : {}),
    };

    // 1. profiles row (canonical store).
    const { error: profileErr } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);
    if (profileErr) return { success: false, error: profileErr.message };

    // 2. Mirror display_name into auth.users.user_metadata so the JWT-driven
    //    top-nav greeting updates without waiting for a row refetch. Use
    //    admin client because users can't write their own user_metadata via
    //    the regular API.
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        display_name: parsed.data.display_name,
        ...(parsed.data.avatar_url !== undefined
          ? { avatar_url: parsed.data.avatar_url }
          : {}),
      },
    });

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard"); // top-nav greeting + welcome card
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── updateMyCenter (admin-only) ───────────────────────────────────────────

export async function updateMyCenter(
  input: z.infer<typeof centerSchema>,
): Promise<ActionResult> {
  try {
    const parsed = centerSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể chỉnh sửa thông tin.",
      };
    }

    const admin = createAdminClient();

    // Fan-out: write to BOTH tenants (legacy) and centers (new) — they share
    // the same UUID per migration 0022, so the same payload goes to both.
    const tenantPatch: Record<string, unknown> = {
      name: parsed.data.name,
    };
    if (parsed.data.logo_url !== undefined) {
      tenantPatch.logo_url = parsed.data.logo_url ?? "";
    }
    if (parsed.data.description !== undefined) {
      tenantPatch.description = parsed.data.description;
    }

    const centerPatch: Record<string, unknown> = {
      name: parsed.data.name,
    };
    if (parsed.data.logo_url !== undefined) {
      centerPatch.logo_url = parsed.data.logo_url ?? "";
    }
    if (parsed.data.address !== undefined) {
      centerPatch.address = parsed.data.address;
    }
    if (parsed.data.phone !== undefined) {
      centerPatch.phone = parsed.data.phone;
    }

    const [tenantRes, centerRes] = await Promise.all([
      admin.from("tenants").update(tenantPatch).eq("id", tenant.id),
      admin.from("centers").update(centerPatch).eq("id", tenant.id),
    ]);
    if (tenantRes.error) return { success: false, error: tenantRes.error.message };
    if (centerRes.error) return { success: false, error: centerRes.error.message };

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
