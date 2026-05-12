import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth Confirm Route Handler
 * ==========================
 * Handles the callback from:
 *   1. Email confirmation links (type=signup, type=email)
 *   2. Google OAuth redirects (with code parameter)
 *
 * PKCE Flow:
 *   - Supabase sends a `code` parameter in the URL
 *   - We exchange it for a session using `exchangeCodeForSession()`
 *   - This prevents token interception attacks
 *
 * Route: GET /auth/confirm?code=xxx&next=/dashboard
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type"); // signup, recovery, email, etc.

  // Construct the redirect URL
  const redirectTo = new URL(next, request.url);

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Clear any Supabase-specific query params before redirecting
      redirectTo.searchParams.delete("code");
      redirectTo.searchParams.delete("next");

      // For email confirmations, add a success message param
      if (type === "signup" || type === "email") {
        redirectTo.searchParams.set("confirmed", "true");
      }

      return NextResponse.redirect(redirectTo);
    }

    // Log the error server-side for debugging
    console.error("[Auth Confirm] Code exchange failed:", error.message);
  }

  // If no code or exchange failed, redirect to an error page
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "auth_confirm_failed");
  errorUrl.searchParams.set(
    "message",
    "Không thể xác nhận tài khoản. Link có thể đã hết hạn.",
  );

  return NextResponse.redirect(errorUrl);
}
