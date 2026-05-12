"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/database";

/**
 * Onboarding Server Actions
 * =========================
 * Handles tenant creation during teacher onboarding.
 */

// ── Check subdomain availability ───────────────────────────────────────────

export async function checkSubdomain(
  subdomain: string,
): Promise<ActionResult<{ available: boolean }>> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", subdomain)
      .single();

    return {
      success: true,
      data: { available: !data },
    };
  } catch {
    return { success: false, error: "Không thể kiểm tra tên miền." };
  }
}

// ── Create Tenant (Onboarding) ─────────────────────────────────────────────

export async function createTenantOnboarding(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Chưa đăng nhập." };
    }

    const tenantName = (formData.get("tenant_name") as string)?.trim();
    const subdomain = (formData.get("subdomain") as string)?.trim().toLowerCase();
    const fullName = (formData.get("full_name") as string)?.trim();

    // Validation
    if (!tenantName || tenantName.length < 2) {
      return { success: false, error: "Tên học viện phải có ít nhất 2 ký tự." };
    }

    if (!subdomain || subdomain.length < 3) {
      return { success: false, error: "Tên miền phải có ít nhất 3 ký tự." };
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
      return {
        success: false,
        error: "Tên miền chỉ được chứa chữ cái, số và dấu gạch ngang.",
      };
    }

    // Check uniqueness
    const { data: existing } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", subdomain)
      .single();

    if (existing) {
      return {
        success: false,
        error: "Tên miền này đã được sử dụng. Vui lòng chọn tên khác.",
      };
    }

    // Check if user already has a tenant
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (existingTenant) {
      return { success: false, error: "Bạn đã có học viện." };
    }

    // Create tenant
    const { error: tenantError } = await supabase.from("tenants").insert({
      owner_id: user.id,
      name: tenantName,
      subdomain,
    });

    if (tenantError) {
      if (tenantError.code === "23505") {
        return {
          success: false,
          error: "Tên miền này đã được sử dụng.",
        };
      }
      return { success: false, error: tenantError.message };
    }

    // Update profile display_name if provided
    if (fullName) {
      await supabase
        .from("profiles")
        .update({ display_name: fullName, role: "teacher" })
        .eq("id", user.id);
    }

    return { success: true };
  } catch {
    return { success: false, error: "Đã xảy ra lỗi. Vui lòng thử lại." };
  }
}
