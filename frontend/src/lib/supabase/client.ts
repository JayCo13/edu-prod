import { createBrowserClient } from "@supabase/ssr";
import { getCookieDomain } from "./cookie-domain";

/**
 * Supabase Browser Client
 * =======================
 * Client-side Supabase client for use in React Client Components.
 *
 * Uses `createBrowserClient` from @supabase/ssr which:
 *   - Automatically handles cookie-based session management
 *   - Works with PKCE flow for secure OAuth
 *   - Re-uses a single instance per browser tab (GoTrue singleton)
 *
 * Cookies are scoped to root domain for cross-subdomain SSO.
 *
 * Usage:
 *   const supabase = createClient();
 *   const { data } = await supabase.auth.getUser();
 */

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and configure NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieDomain = getCookieDomain();

  return createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: {
      // Scope cookies to root domain for cross-subdomain SSO
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  });
}
