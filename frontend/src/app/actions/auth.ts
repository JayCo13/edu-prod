"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TENANT_HEADER } from "@/lib/tenant-context";

/**
 * Auth Server Actions (Multi-tenant)
 * ====================================
 * Handles both root-domain and subdomain registration:
 *
 *   Root domain (ticoclass.com/register):
 *     → Role: teacher
 *     → Auto-creates a Tenant for their school
 *
 *   Subdomain (thaynam.ticoclass.com/register):
 *     → Role: student
 *     → Links profile.tenant_id to the tenant
 *
 * Existing signIn / signInWithGoogle / signOut remain unchanged.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthResult {
  error?: string;
  success?: boolean;
  message?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

async function getTenantSlugFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get(TENANT_HEADER);
}

// ── Multi-tenant Sign Up ───────────────────────────────────────────────────
// The DB trigger `handle_new_user()` reads `role` and `tenant_id` directly
// from `raw_user_meta_data`, creating the profile row atomically.
// No setTimeout, no separate UPDATE — single source of truth.

export async function signUpMultiTenant(
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  if (!email || !password || !displayName) {
    return { error: "Vui lòng điền đầy đủ thông tin." };
  }

  if (password.length < 8) {
    return { error: "Mật khẩu phải có ít nhất 8 ký tự." };
  }

  const origin = await getOrigin();
  const tenantSlug = await getTenantSlugFromHeaders();
  const isSubdomain = !!tenantSlug;

  // If subdomain, verify the tenant exists and get its ID
  let tenantId: string | null = null;
  if (isSubdomain) {
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", tenantSlug)
      .single();

    if (tenantError || !tenant) {
      return { error: "Học viện không tồn tại. Vui lòng kiểm tra lại đường dẫn." };
    }
    tenantId = tenant.id;
  }

  // Determine role based on context
  const role = isSubdomain ? "student" : "teacher";

  // Create auth user — trigger reads metadata and creates profile atomically
  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: {
        display_name: displayName,
        role,                           // → trigger reads this
        tenant_id: tenantId || "",      // → trigger reads this (empty = NULL)
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  // Teacher tenant creation is handled by /onboarding (not here)

  return {
    success: true,
    message: "Một email xác nhận đã được gửi. Vui lòng kiểm tra hộp thư của bạn.",
  };
}

// ── Sign In (unchanged, works for both root and subdomain) ─────────────────

export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Vui lòng nhập email và mật khẩu." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      return { error: "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư." };
    }
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Email hoặc mật khẩu không chính xác." };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}

// ── Google OAuth ───────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/confirm`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Không thể kết nối với Google. Vui lòng thử lại." };
}

// ── Sign Out ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ── Forgot Password (White-label) ──────────────────────────────────────────
// The reset link redirects to the SAME ORIGIN the user requested from.
// E.g., student on thaynam.ticoclass.com gets link back to thaynam.ticoclass.com.

export async function requestPasswordReset(
  formData: FormData,
): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const email = (formData.get("email") as string)?.trim();

    if (!email) {
      return { error: "Vui lòng nhập email." };
    }

    const origin = await getOrigin();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/update-password`,
    });

    if (error) {
      // Don't reveal whether email exists (security)
      console.error("[Password Reset]", error.message);
    }

    // Always show success to prevent email enumeration
    return {
      success: true,
      message: "Nếu email tồn tại, một link khôi phục đã được gửi. Vui lòng kiểm tra hộp thư.",
    };
  } catch {
    return { error: "Đã xảy ra lỗi. Vui lòng thử lại." };
  }
}

// ── Update Password (after reset link) ─────────────────────────────────────

export async function updatePassword(
  formData: FormData,
): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!password || !confirmPassword) {
      return { error: "Vui lòng nhập đầy đủ." };
    }

    if (password.length < 8) {
      return { error: "Mật khẩu phải có ít nhất 8 ký tự." };
    }

    if (password !== confirmPassword) {
      return { error: "Mật khẩu xác nhận không khớp." };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      if (error.message.includes("same_password")) {
        return { error: "Mật khẩu mới phải khác mật khẩu cũ." };
      }
      return { error: error.message };
    }

    return {
      success: true,
      message: "Mật khẩu đã được cập nhật thành công.",
    };
  } catch {
    return { error: "Đã xảy ra lỗi. Vui lòng thử lại." };
  }
}
