"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBunnyVideoEntry, generateUploadSignature } from "@/lib/bunny/stream";
import type {
  ModuleRow,
  LessonRow,
  ModuleWithLessons,
  ReorderPayload,
  ActionResult,
  TenantRow,
  LessonType,
} from "@/types/database";
import { z } from "zod";

/**
 * Curriculum Server Actions
 * =========================
 * CRUD + Reorder operations for Modules and Lessons.
 * All operations are tenant-scoped via getCurrentTenant().
 *
 * Architecture:
 *   - getCurriculum() fetches modules + lessons as nested tree
 *   - reorderCurriculum() batch-updates order_index after drag-and-drop
 *   - All mutations call revalidatePath to refresh the page
 */

// ── Validation Schemas ────────────────────────────────────────────────────

const createModuleSchema = z.object({
  title: z
    .string()
    .min(1, "Tên chương không được để trống")
    .max(200, "Tên chương không được quá 200 ký tự"),
});

const updateModuleSchema = z.object({
  title: z
    .string()
    .min(1, "Tên chương không được để trống")
    .max(200, "Tên chương không được quá 200 ký tự")
    .optional(),
  is_published: z.boolean().optional(),
});

const createLessonSchema = z.object({
  title: z
    .string()
    .min(1, "Tên bài học không được để trống")
    .max(200, "Tên bài học không được quá 200 ký tự"),
  lesson_type: z.enum(["video", "text", "quiz"]).default("video"),
});

const updateLessonSchema = z.object({
  title: z
    .string()
    .min(1, "Tên bài học không được để trống")
    .max(200, "Tên bài học không được quá 200 ký tự")
    .optional(),
  lesson_type: z.enum(["video", "text", "quiz"]).optional(),
  is_published: z.boolean().optional(),
  content: z.string().nullable().optional(),
  video_url: z.string().url("URL video không hợp lệ").nullable().optional(),
  video_duration: z.number().int().min(0).optional(),
  is_free_preview: z.boolean().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Get the current teacher's tenant.
 * Reused pattern from courses.ts.
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

/**
 * Verify that a course belongs to the current tenant.
 * Returns the supabase client for chaining.
 */
async function verifyCourseBelongsToTenant(courseId: string) {
  const ctx = await getCurrentTenant();
  const { supabase, tenant } = ctx;

  const { data: course, error } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("tenant_id", tenant.id)
    .single();

  if (error || !course) {
    throw new Error("CourseNotFound");
  }

  return ctx;
}

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message = err instanceof Error ? err.message : "Unknown error";
  if (message === "NoTenant") {
    return { success: false, error: "Bạn chưa tạo học viện." };
  }
  if (message === "Unauthorized") {
    return { success: false, error: "Phiên đăng nhập hết hạn." };
  }
  if (message === "CourseNotFound") {
    return { success: false, error: "Khóa học không tồn tại hoặc không thuộc về bạn." };
  }
  return { success: false, error: message };
}

// ── GET CURRICULUM ────────────────────────────────────────────────────────

export async function getCurriculum(
  courseId: string,
): Promise<ActionResult<ModuleWithLessons[]>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    // Fetch modules
    const { data: modules, error: modulesError } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (modulesError) {
      return { success: false, error: modulesError.message };
    }

    // Fetch all lessons for this course (filter by module_id in JS)
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (lessonsError) {
      return { success: false, error: lessonsError.message };
    }

    // Map lessons into their modules
    const modulesWithLessons: ModuleWithLessons[] = (modules as ModuleRow[]).map(
      (mod) => ({
        ...mod,
        lessons: ((lessons as LessonRow[]) || []).filter(
          (lesson) => lesson.module_id === mod.id,
        ),
      }),
    );

    return { success: true, data: modulesWithLessons };
  } catch (err) {
    return handleError<ModuleWithLessons[]>(err);
  }
}

// ── CREATE MODULE ─────────────────────────────────────────────────────────

export async function createModule(
  courseId: string,
  title: string,
): Promise<ActionResult<ModuleRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const parsed = createModuleSchema.safeParse({ title });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    // Get max order_index for this course
    const { data: existing } = await supabase
      .from("modules")
      .select("order_index")
      .eq("course_id", courseId)
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from("modules")
      .insert({
        course_id: courseId,
        title: parsed.data.title,
        order_index: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true, data: data as ModuleRow };
  } catch (err) {
    return handleError<ModuleRow>(err);
  }
}

// ── UPDATE MODULE ─────────────────────────────────────────────────────────

export async function updateModule(
  moduleId: string,
  courseId: string,
  updates: { title?: string; is_published?: boolean },
): Promise<ActionResult<ModuleRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const parsed = updateModuleSchema.safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    const { data, error } = await supabase
      .from("modules")
      .update(parsed.data)
      .eq("id", moduleId)
      .eq("course_id", courseId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true, data: data as ModuleRow };
  } catch (err) {
    return handleError<ModuleRow>(err);
  }
}

// ── DELETE MODULE ─────────────────────────────────────────────────────────

export async function deleteModule(
  moduleId: string,
  courseId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", moduleId)
      .eq("course_id", courseId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── CREATE LESSON ─────────────────────────────────────────────────────────

export async function createLesson(
  moduleId: string,
  courseId: string,
  title: string,
  lessonType: LessonType = "video",
): Promise<ActionResult<LessonRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const parsed = createLessonSchema.safeParse({ title, lesson_type: lessonType });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    // Get max order_index for this module
    const { data: existing } = await supabase
      .from("lessons")
      .select("order_index")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        course_id: courseId,
        module_id: moduleId,
        title: parsed.data.title,
        lesson_type: parsed.data.lesson_type,
        order_index: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true, data: data as LessonRow };
  } catch (err) {
    return handleError<LessonRow>(err);
  }
}

// ── UPDATE LESSON ─────────────────────────────────────────────────────────

export async function updateLesson(
  lessonId: string,
  courseId: string,
  updates: { title?: string; lesson_type?: LessonType; is_published?: boolean; content?: string | null; video_url?: string | null; video_duration?: number; is_free_preview?: boolean },
): Promise<ActionResult<LessonRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const parsed = updateLessonSchema.safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    const { data, error } = await supabase
      .from("lessons")
      .update(parsed.data)
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true, data: data as LessonRow };
  } catch (err) {
    return handleError<LessonRow>(err);
  }
}

// ── DELETE LESSON ─────────────────────────────────────────────────────────

export async function deleteLesson(
  lessonId: string,
  courseId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("course_id", courseId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── REORDER CURRICULUM (Batch Update) ─────────────────────────────────────

/**
 * Batch-update order_index for modules AND lessons after drag-and-drop.
 *
 * This is the CRITICAL action called after every drag event.
 * It receives the full new ordering and updates all affected rows.
 *
 * Strategy:
 *   - Update modules one-by-one (small N, typically <20)
 *   - Update lessons one-by-one (moderate N, typically <100)
 *   - Both wrapped in a single action for atomicity from the UI's perspective
 *
 * NOTE: Supabase JS client doesn't support multi-row updates in a single call,
 *       so we fire individual updates. RLS handles authz per-row.
 */
export async function reorderCurriculum(
  courseId: string,
  payload: ReorderPayload,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    // Update module order
    for (const mod of payload.modules) {
      const { error } = await supabase
        .from("modules")
        .update({ order_index: mod.order_index })
        .eq("id", mod.id)
        .eq("course_id", courseId);

      if (error) {
        console.error("[reorderCurriculum] Module update failed:", error);
        return { success: false, error: `Lỗi cập nhật thứ tự chương: ${error.message}` };
      }
    }

    // Update lesson order + module_id (lessons can move between modules)
    for (const lesson of payload.lessons) {
      const { error } = await supabase
        .from("lessons")
        .update({
          order_index: lesson.order_index,
          module_id: lesson.module_id,
        })
        .eq("id", lesson.id)
        .eq("course_id", courseId);

      if (error) {
        console.error("[reorderCurriculum] Lesson update failed:", error);
        return { success: false, error: `Lỗi cập nhật thứ tự bài học: ${error.message}` };
      }
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── GET LESSON BY ID ──────────────────────────────────────────────────────

/**
 * Fetch a single lesson by ID, with ownership verification.
 * Used by the Lesson Editor page to load lesson content.
 */
export async function getLessonById(
  lessonId: string,
  courseId: string,
): Promise<ActionResult<LessonRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .single();

    if (error || !data) {
      return { success: false, error: "Bài học không tồn tại." };
    }

    return { success: true, data: data as LessonRow };
  } catch (err) {
    return handleError<LessonRow>(err);
  }
}

// ── UPDATE LESSON CONTENT (Editor-specific) ───────────────────────────────

/**
 * Update lesson content fields from the Lesson Editor.
 * Accepts content (HTML), video_url, video_duration, is_free_preview.
 *
 * Separate from updateLesson to keep the Zod schema relaxed for
 * content-only saves (video_url can be empty string → null, etc.).
 */
const updateLessonContentSchema = z.object({
  content: z.string().nullable().optional(),
  video_url: z.string().nullable().optional(),
  video_duration: z.number().int().min(0).optional(),
  is_free_preview: z.boolean().optional(),
});

export async function updateLessonContent(
  lessonId: string,
  courseId: string,
  updates: {
    content?: string | null;
    video_url?: string | null;
    video_duration?: number;
    is_free_preview?: boolean;
  },
): Promise<ActionResult<LessonRow>> {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    const parsed = updateLessonContentSchema.safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message };
    }

    // Normalize empty video_url string to null
    const cleanData = {
      ...parsed.data,
      video_url: parsed.data.video_url?.trim() || null,
    };

    const { data, error } = await supabase
      .from("lessons")
      .update(cleanData)
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
    return { success: true, data: data as LessonRow };
  } catch (err) {
    return handleError<LessonRow>(err);
  }
}

// ── DIRECT VIDEO UPLOAD (BunnyCDN) ────────────────────────────────────────

export async function getBunnyUploadTicket(
  lessonId: string,
  courseId: string,
  title: string,
) {
  try {
    const { supabase } = await verifyCourseBelongsToTenant(courseId);

    // 1. Create a video placeholder in Bunny Stream
    const videoId = await createBunnyVideoEntry(title);

    // 2. Generate secure TUS signature for client upload
    const signatureData = generateUploadSignature(videoId);

    // 3. Temporarily save the guid to the lesson so we know what video it's linked to
    // We prefix with `bunny://` to distinguish from direct URLs.
    const { error } = await supabase
      .from("lessons")
      .update({ video_url: `bunny://${videoId}` })
      .eq("id", lessonId)
      .eq("course_id", courseId);

    if (error) throw new Error(error.message);

    return { success: true, data: signatureData };
  } catch (err) {
    return handleError<{ signature: string; expirationTime: number; libraryId: string; videoId: string }>(err);
  }
}

export async function confirmVideoUpload(
  lessonId: string,
  courseId: string,
) {
  try {
    // Client calls this when TUS upload finishes successfully
    await verifyCourseBelongsToTenant(courseId);
    
    // In a production app, we might also want to fetch the duration from Bunny API here,
    // or just rely on webhooks. For now, we just revalidate the cache.
    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);

    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
