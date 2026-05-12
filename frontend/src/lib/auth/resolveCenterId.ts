/**
 * resolveCenterId() — request-scoped helper.
 *
 * Per PRD §5.1: "every domain object MUST belong to a center_id; all
 * queries MUST filter by center_id of the authenticated user." This
 * resolves that center_id from `user_centers` for the current Supabase
 * session.
 *
 * Multi-center users (PRD §2.2: teachers commonly belong to several
 * centers) pick their active center via the X-Center-Id request header
 * — the UI sets it; the helper validates the user is an active member.
 * Falls back to the user's first/oldest active membership.
 *
 * Returns a discriminated union so callers can render a clean Vietnamese
 * error rather than a 500.
 *
 * NOT Edge middleware: this runs server-side inside route handlers and
 * Server Components/Actions. Edge runtime can't reach Supabase the same
 * way and a DB hit per request in middleware is too expensive.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CenterRole, CenterMemberStatus } from "@/modules/centers/types";

export type ResolveCenterResult =
  | {
      ok: true;
      userId: string;
      centerId: string;
      role: CenterRole;
      status: CenterMemberStatus;
    }
  | { ok: false; reason: "UNAUTHENTICATED" | "NO_CENTER" | "FORBIDDEN_CENTER"; message: string };

const HEADER_CENTER_ID = "x-center-id";

interface ResolveOptions {
  /** Explicit center the request is targeting. Wins over the header / fallback. */
  centerId?: string | null;
  /** Headers from the inbound request (Route Handler). When omitted, header lookup is skipped. */
  headers?: Headers;
  /** Optional role gate (e.g. "CENTER_ADMIN"). Failing match → FORBIDDEN_CENTER. */
  requireRole?: CenterRole;
}

export async function resolveCenterId(
  options: ResolveOptions = {},
): Promise<ResolveCenterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: "UNAUTHENTICATED",
      message: "Phiên đăng nhập đã hết hạn.",
    };
  }

  const requested =
    options.centerId ??
    options.headers?.get(HEADER_CENTER_ID) ??
    null;

  if (requested) {
    const { data, error } = await supabase
      .from("user_centers")
      .select("center_id, role_in_center, status")
      .eq("user_id", user.id)
      .eq("center_id", requested)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        reason: "FORBIDDEN_CENTER",
        message: "Bạn không có quyền truy cập trung tâm này.",
      };
    }
    if (data.status !== "ACTIVE") {
      return {
        ok: false,
        reason: "FORBIDDEN_CENTER",
        message: "Quyền truy cập trung tâm đang bị tạm dừng.",
      };
    }
    if (options.requireRole && data.role_in_center !== options.requireRole) {
      return {
        ok: false,
        reason: "FORBIDDEN_CENTER",
        message: "Bạn không có quyền thực hiện hành động này.",
      };
    }
    return {
      ok: true,
      userId: user.id,
      centerId: data.center_id as string,
      role: data.role_in_center as CenterRole,
      status: data.status as CenterMemberStatus,
    };
  }

  // No specific center requested → pick the oldest active membership.
  // Predictable fallback so refresh doesn't shuffle the active center.
  const { data: rows, error } = await supabase
    .from("user_centers")
    .select("center_id, role_in_center, status")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    return {
      ok: false,
      reason: "NO_CENTER",
      message: "Không thể xác định trung tâm hiện hành.",
    };
  }

  const row = rows?.[0];
  if (!row) {
    return {
      ok: false,
      reason: "NO_CENTER",
      message: "Tài khoản của bạn chưa thuộc trung tâm nào.",
    };
  }

  if (options.requireRole && row.role_in_center !== options.requireRole) {
    return {
      ok: false,
      reason: "FORBIDDEN_CENTER",
      message: "Bạn không có quyền thực hiện hành động này.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    centerId: row.center_id as string,
    role: row.role_in_center as CenterRole,
    status: row.status as CenterMemberStatus,
  };
}
