import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js Middleware
 * ==================
 * Runs before every matched request to:
 *   1. Refresh Supabase auth session (prevent stale cookies)
 *   2. Protect /dashboard routes (redirect to /login if unauthenticated)
 *   3. Redirect authenticated users from /login, /register to /dashboard
 */

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *   - _next/static (static files)
     *   - _next/image (image optimization)
     *   - favicon.ico (browser icon)
     *   - Public assets (images, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
