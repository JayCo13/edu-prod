"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CourseRow,
  CourseUpdate,
  ActionResult,
  TenantRow,
} from "@/types/database";
import { z } from "zod";

/**
 * Course Server Actions (Multi-tenant)
 * =====================================
 * All operations are scoped to the teacher's tenant.
 * Architecture:
 *   1. getCurrentTenant() resolves auth.uid → tenant
 *   2. Actions pass tenant_id for INSERT, RLS handles the rest
 *   3. revalidatePath after every mutation
 */

// ── Validation Schemas ─────────────────────────────────────────────────────

const createCourseSchema = z.object({
  title: z
    .string()
    .min(3, "Tiêu đề phải có ít nhất 3 ký tự")
    .max(200, "Tiêu đề không được quá 200 ký tự"),
  description: z
    .string()
    .max(5000, "Mô tả không được quá 5000 ký tự")
    .optional()
    .default(""),
  price: z
    .number()
    .min(0, "Giá không được âm")
    .default(0),
});

const updateCourseSchema = z.object({
  title: z
    .string()
    .min(3, "Tiêu đề phải có ít nhất 3 ký tự")
    .max(200, "Tiêu đề không được quá 200 ký tự")
    .optional(),
  description: z
    .string()
    .max(5000, "Mô tả không được quá 5000 ký tự")
    .optional(),
  price: z.number().min(0, "Giá không được âm").optional(),
  status: z.enum(["draft", "published"]).optional(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate URL-friendly slug from title */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Get the current teacher's tenant.
 * Returns { supabase, tenant } or throws if not authenticated/no tenant.
 */
async function getCurrentTenant(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenant: TenantRow;
  userId: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (tenantError || !tenant) {
    throw new Error("NoTenant");
  }

  return { supabase, tenant: tenant as TenantRow, userId: user.id };
}

// ── GET COURSES ────────────────────────────────────────────────────────────

export async function getCourses(): Promise<ActionResult<CourseRow[]>> {
  try {
    const { supabase, tenant } = await getCurrentTenant();

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as CourseRow[] };
  } catch {
    return { success: false, error: "Không thể tải danh sách khóa học." };
  }
}

// ── GET COURSE STATS (for dashboard) ───────────────────────────────────────

export async function getCourseStats(): Promise<
  ActionResult<{
    total: number;
    published: number;
    draft: number;
  }>
> {
  try {
    const { supabase, tenant } = await getCurrentTenant();

    const { data, error } = await supabase
      .from("courses")
      .select("status")
      .eq("tenant_id", tenant.id);

    if (error) {
      return { success: false, error: error.message };
    }

    const courses = data || [];
    return {
      success: true,
      data: {
        total: courses.length,
        published: courses.filter((c) => c.status === "published").length,
        draft: courses.filter((c) => c.status === "draft").length,
      },
    };
  } catch {
    return { success: false, data: { total: 0, published: 0, draft: 0 } };
  }
}

// ── CREATE COURSE ──────────────────────────────────────────────────────────

export async function createCourse(
  formData: FormData,
): Promise<ActionResult<CourseRow>> {
  try {
    const { supabase, tenant, userId } = await getCurrentTenant();

    // Parse & validate
    const raw = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || "",
      price: parseFloat((formData.get("price") as string) || "0"),
    };

    const parsed = createCourseSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return { success: false, error: firstError };
    }

    const { title, description, price } = parsed.data;
    const slug = slugify(title) || `course-${Date.now()}`;

    const { data, error } = await supabase
      .from("courses")
      .insert({
        teacher_id: userId,     // Legacy FK (NOT NULL)
        tenant_id: tenant.id,   // Multi-tenant FK
        title,
        slug,
        description,
        price,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "Đã tồn tại khóa học với tiêu đề tương tự. Hãy thử tên khác.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard");
    return { success: true, data: data as CourseRow };
  } catch (err) {
    console.error("[createCourse] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "NoTenant") {
      return { success: false, error: "Bạn chưa tạo học viện. Vui lòng hoàn thành Onboarding trước." };
    }
    if (message === "Unauthorized") {
      return { success: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." };
    }
    return { success: false, error: `Không thể tạo khóa học: ${message}` };
  }
}

// ── UPDATE COURSE ──────────────────────────────────────────────────────────

export async function updateCourse(
  courseId: string,
  formData: FormData,
): Promise<ActionResult<CourseRow>> {
  try {
    const { supabase } = await getCurrentTenant();

    const raw: Record<string, unknown> = {};
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const price = formData.get("price") as string | null;
    const status = formData.get("status") as string | null;

    if (title !== null) raw.title = title;
    if (description !== null) raw.description = description;
    if (price !== null) raw.price = parseFloat(price);
    if (status !== null) raw.status = status;

    const parsed = updateCourseSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return { success: false, error: firstError };
    }

    const updates: CourseUpdate = { ...parsed.data };

    // Auto-update slug if title changed
    if (updates.title) {
      updates.slug = slugify(updates.title) || undefined;
    }

    const { data, error } = await supabase
      .from("courses")
      .update(updates)
      .eq("id", courseId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard");
    return { success: true, data: data as CourseRow };
  } catch {
    return { success: false, error: "Không thể cập nhật khóa học." };
  }
}

// ── DELETE COURSE ──────────────────────────────────────────────────────────

export async function deleteCourse(
  courseId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await getCurrentTenant();

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Không thể xóa khóa học." };
  }
}
