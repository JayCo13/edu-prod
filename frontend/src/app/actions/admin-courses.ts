"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ActionResult, CourseRow } from "@/types/database";

/**
 * Admin Courses — minimal CRUD
 * =============================
 * v1 surface so center admins can create "Khóa học" entries that live
 * sessions can attach to for context (course title + slug on the calendar).
 * Intentionally narrow: title + description only. The legacy schema fields
 * (price, currency, thumbnail, lessons_count, …) keep their column defaults
 * since the LMS shape is out of scope (PRD §1.4) — we treat the courses
 * table as a flat "container the session belongs to" until the real
 * `classes` module lands (PRD §6).
 *
 * Auth: every mutation requires isAdmin; reads are admin-only too (the
 * existing courses RLS already restricts to tenant owners — see migration
 * 0004 — and we surface only what the policy allows).
 */

// ── Validation ────────────────────────────────────────────────────────────

const createCourseSchema = z.object({
  title: z
    .string()
    .min(2, "Tên khóa học phải có ít nhất 2 ký tự")
    .max(200, "Tên khóa học không được quá 200 ký tự"),
  description: z
    .string()
    .max(2000, "Mô tả không được quá 2000 ký tự")
    .optional()
    .default(""),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

/** Slug: lowercase, diacritic-stripped, dash-separated. Random 6-char suffix
 *  to avoid collisions (the column has a UNIQUE constraint in the legacy
 *  schema). Acceptable trade-off for v1 — admins don't see slugs anywhere. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "khoa-hoc"}-${suffix}`;
}

// ── List ──────────────────────────────────────────────────────────────────

export type AdminCourseRow = Pick<
  CourseRow,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "status"
  | "created_at"
  | "updated_at"
>;

export async function listAdminCourses(): Promise<
  ActionResult<AdminCourseRow[]>
> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị trung tâm mới có thể xem khóa học.",
      };
    }
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, slug, description, status, created_at, updated_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AdminCourseRow[] };
  } catch (err) {
    return handleError(err);
  }
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createAdminCourse(
  input: z.infer<typeof createCourseSchema>,
): Promise<ActionResult<AdminCourseRow>> {
  try {
    const parsed = createCourseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const { supabase, tenant, userId, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị trung tâm mới có thể tạo khóa học.",
      };
    }

    const title = parsed.data.title.trim();
    const description = parsed.data.description?.trim() ?? "";
    const slug = slugify(title);

    const { data, error } = await supabase
      .from("courses")
      .insert({
        tenant_id: tenant.id,
        teacher_id: userId, // legacy NOT NULL; we attribute to the creator.
        title,
        slug,
        description,
      })
      .select("id, title, slug, description, status, created_at, updated_at")
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/calendar"); // session-create dropdown refreshes
    return { success: true, data: data as AdminCourseRow };
  } catch (err) {
    return handleError<AdminCourseRow>(err);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteAdminCourse(
  id: string,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị trung tâm mới có thể xóa khóa học.",
      };
    }

    // Block delete when sessions are attached — deleting a course with the
    // FK's ON DELETE CASCADE would silently wipe their sessions, and the
    // admin probably means to unlink the sessions first.
    const { count } = await supabase
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id)
      .eq("tenant_id", tenant.id);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: `Không thể xóa: còn ${count} buổi học đang liên kết với khóa này.`,
      };
    }

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
