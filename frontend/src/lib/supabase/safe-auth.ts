import type { SupabaseClient, User } from "@supabase/supabase-js";

const TIMEOUT_MS = 1500;
const COOLDOWN_MS = 30_000;

let nextRetryAt = 0;

export async function safeGetUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  if (Date.now() < nextRetryAt) return null;

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("supabase-auth-timeout")), TIMEOUT_MS),
      ),
    ]);
    return result.data.user ?? null;
  } catch {
    nextRetryAt = Date.now() + COOLDOWN_MS;
    return null;
  }
}
