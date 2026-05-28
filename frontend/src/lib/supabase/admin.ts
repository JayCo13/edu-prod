import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Service-Role (Admin) Client
 * =====================================
 * Bypasses RLS. ONLY use inside Server Actions or Route Handlers — never in
 * a Client Component, never anywhere the resulting client could leak to the
 * browser.
 *
 * Auth flows that need this:
 *   - auth.admin.inviteUserByEmail
 *   - auth.admin.listUsers / getUserById
 *   - auth.admin.deleteUser / updateUserById
 *
 * For ordinary tenant-scoped queries, use `createClient()` from ./server.ts
 * (the user-session client). The service-role client has no session and is
 * not subject to RLS — every row is visible.
 *
 * Env vars (server-only, NOT prefixed NEXT_PUBLIC_):
 *   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL as a fallback)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

export function createAdminClient() {
  // Hard guard: if this ever runs in the browser, the key would be exposed.
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must only be called server-side. The service-role key must never reach the browser.",
    );
  }

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing service-role env vars. Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) in your server environment. The key is in Supabase Dashboard → Settings → API → service_role secret.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
