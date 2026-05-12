import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCookieDomain } from "./cookie-domain";

/**
 * Supabase Server Client
 * ======================
 * Server-side Supabase client for use in:
 *   - Server Components
 *   - Server Actions
 *   - Route Handlers
 *
 * Reads/writes auth cookies via Next.js `cookies()` API.
 * Cookies are scoped to the root domain for cross-subdomain SSO.
 *
 * Usage:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and configure NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();
  const cookieDomain = getCookieDomain();

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // Scope cookies to root domain for cross-subdomain SSO
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              }),
            );
          } catch {
            // setAll can fail in Server Components (read-only).
            // This is expected — the middleware will handle cookie refresh.
          }
        },
      },
    },
  );
}
