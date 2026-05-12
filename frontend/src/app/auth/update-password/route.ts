import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Password Reset Callback Route Handler
 * ======================================
 * Handles the callback from Supabase password reset emails.
 * Exchanges the code for a session, then redirects to the update form.
 *
 * Route: GET /auth/update-password?code=xxx
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // Session established — redirect to update password form
        const url = new URL("/update-password", request.url);
        return NextResponse.redirect(url);
      }

      console.error("[Update Password] Code exchange failed:", error.message);
    } catch (err) {
      console.error("[Update Password] Unexpected error:", err);
    }
  }

  // Fallback: redirect to login with error
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "reset_link_expired");
  errorUrl.searchParams.set(
    "message",
    "Link khôi phục đã hết hạn. Vui lòng yêu cầu lại.",
  );
  return NextResponse.redirect(errorUrl);
}
