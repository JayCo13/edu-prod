import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Invite Acceptance Callback
 * ===========================
 * Destination of the invite magic-link sent by
 * `auth.admin.inviteUserByEmail`. Exchanges the one-time code for a
 * session, then redirects the freshly-authenticated teacher to the
 * welcome / set-password page.
 *
 * The auth.users INSERT that happens during this exchange fires the
 * 0018 trigger, which auto-fills any matching tenant_teachers.profile_id.
 *
 * Route: GET /auth/setup?code=xxx
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL("/welcome", request.url));
      }
      console.error("[Auth Setup] Code exchange failed:", error.message);
    } catch (err) {
      console.error("[Auth Setup] Unexpected error:", err);
    }
  }

  // Fallback: invite expired or tampered — send them to login with a hint.
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("error", "invite_expired");
  errorUrl.searchParams.set(
    "message",
    "Lời mời đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu quản trị viên gửi lại.",
  );
  return NextResponse.redirect(errorUrl);
}
