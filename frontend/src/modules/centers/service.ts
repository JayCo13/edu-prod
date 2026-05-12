/**
 * Centers service — business logic.
 *
 * Composes auth (Supabase `auth.getUser`), validation (Zod schemas), and
 * the repository layer. Returns a uniform `CentersResult<T>` envelope so
 * the route-handler + server-action surfaces stay thin and shape-stable.
 *
 * Error strings here are user-facing and Vietnamese (CLAUDE.md §8.3).
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { centerCreateSchema, centerUpdateSchema } from "./schemas";
import {
  findCenterById,
  findCentersForUser,
  findMembership,
  insertCenter,
  insertUserCenter,
  updateCenter,
} from "./repository";
import type {
  CenterCreateInput,
  CenterRow,
  CenterUpdateInput,
  CentersResult,
} from "./types";

async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function unexpectedError(err: unknown): string {
  // Surface Postgrest errors when available — RLS denials look like
  // "PGRST...": helpful for debugging without leaking SQL into the UI.
  if (err instanceof Error) return err.message;
  return "Đã xảy ra lỗi không xác định.";
}

/**
 * GET /api/v1/centers — list centers the caller belongs to.
 */
export async function listCentersForCaller(): Promise<
  CentersResult<CenterRow[]>
> {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return { success: false, error: "Phiên đăng nhập đã hết hạn." };
    }

    const supabase = await createClient();
    const data = await findCentersForUser(supabase, userId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: unexpectedError(err) };
  }
}

/**
 * GET /api/v1/centers/:id — fetch one center the caller belongs to.
 * RLS returns null for non-members, surfaced as "not found".
 */
export async function getCenterById(
  id: string,
): Promise<CentersResult<CenterRow>> {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return { success: false, error: "Phiên đăng nhập đã hết hạn." };
    }

    const supabase = await createClient();
    const center = await findCenterById(supabase, id);
    if (!center) {
      return { success: false, error: "Không tìm thấy trung tâm." };
    }
    return { success: true, data: center };
  } catch (err) {
    return { success: false, error: unexpectedError(err) };
  }
}

/**
 * POST /api/v1/centers — create a center and add the caller as CENTER_ADMIN.
 *
 * Both inserts must succeed together; if the user_centers insert fails
 * after the center insert, the center row is unreachable (RLS hides it
 * from its own creator) — we roll back manually to keep things tidy.
 *
 * Postgres lacks a transactional Supabase JS API, so we delete on failure
 * rather than wrap in BEGIN/COMMIT. A future revision should move this
 * into an RPC function for atomicity.
 */
export async function createCenter(
  input: CenterCreateInput,
): Promise<CentersResult<CenterRow>> {
  const parsed = centerCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return { success: false, error: "Phiên đăng nhập đã hết hạn." };
    }

    const supabase = await createClient();
    const center = await insertCenter(supabase, parsed.data);

    try {
      await insertUserCenter(supabase, userId, center.id, "CENTER_ADMIN");
    } catch (membershipErr) {
      // Roll back the orphaned center row. Best-effort: if this delete
      // fails too, the row is recoverable via a DB-admin cleanup since it
      // has no members and RLS hides it from everyone.
      await supabase.from("centers").delete().eq("id", center.id);
      throw membershipErr;
    }

    return { success: true, data: center };
  } catch (err) {
    return { success: false, error: unexpectedError(err) };
  }
}

/**
 * PATCH /api/v1/centers/:id — update settings. CENTER_ADMIN only.
 *
 * Authorization is enforced both at the service layer (explicit role check
 * for a clean error message) and at RLS (defense in depth: the policy
 * "centers: admin update" gates the actual write).
 */
export async function updateCenterSettings(
  id: string,
  patch: CenterUpdateInput,
): Promise<CentersResult<CenterRow>> {
  const parsed = centerUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return { success: false, error: "Phiên đăng nhập đã hết hạn." };
    }

    const supabase = await createClient();
    const membership = await findMembership(supabase, userId, id);
    if (!membership || membership.status !== "ACTIVE") {
      return { success: false, error: "Bạn không có quyền truy cập trung tâm này." };
    }
    if (membership.role_in_center !== "CENTER_ADMIN") {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới được cập nhật cấu hình.",
      };
    }

    const updated = await updateCenter(supabase, id, parsed.data);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: unexpectedError(err) };
  }
}
