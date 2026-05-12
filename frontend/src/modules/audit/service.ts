/**
 * Audit service — write + read.
 *
 * Writes go through `logAuditEntry` from inside other modules' service
 * layers (e.g. payroll). The function never throws — audit-write
 * failures are logged to console.error but don't block the underlying
 * mutation. (Losing a log row is bad, but rolling back a teacher's
 * approved adjustment because we couldn't write a log line is worse.)
 *
 * Reads go through `listAuditLogs` which resolves the active center
 * and filters server-side. RLS is the second line of defense.
 */

import "server-only";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";
import { insertAuditLog, listAuditLogsForCenter } from "./repository";
import type {
  AuditListFilters,
  AuditLogInput,
  AuditLogRow,
  AuditMetadata,
  AuditResult,
} from "./types";

/**
 * Internal write. Best-effort: on failure logs to console and continues.
 * Caller passes the resolved center_id explicitly (the audit log must
 * match the row being mutated, not the caller's "current" center).
 */
export async function logAuditEntry(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient();
    await insertAuditLog(supabase, input);
  } catch (err) {
    // Don't propagate — see header comment.
    console.error("[audit] failed to write log entry", { input, err });
  }
}

/**
 * Augment metadata with request-scoped IP + user-agent. Server Actions
 * + Route Handlers both have access to next/headers; this helper makes
 * the boilerplate one line.
 */
export async function buildRequestMetadata(
  base: AuditMetadata,
): Promise<AuditMetadata> {
  try {
    const h = await headers();
    return {
      ...base,
      ip:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        undefined,
      user_agent: h.get("user-agent") ?? undefined,
    };
  } catch {
    // headers() can throw outside a request context (e.g. background jobs).
    return base;
  }
}

/**
 * Public read API used by the audit log modal. Always scoped to the
 * caller's active center; RLS rejects cross-center attempts.
 */
export async function listAuditLogs(
  filters: AuditListFilters = {},
): Promise<AuditResult<AuditLogRow[]>> {
  const resolved = await resolveCenterId({ requireRole: "CENTER_ADMIN" });
  if (!resolved.ok) {
    return { success: false, error: resolved.message };
  }
  try {
    const supabase = await createClient();
    const data = await listAuditLogsForCenter(
      supabase,
      resolved.centerId,
      filters,
    );
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Không thể tải lịch sử.",
    };
  }
}
