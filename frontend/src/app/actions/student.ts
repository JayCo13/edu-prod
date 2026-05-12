"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  LessonRow,
  LessonProgressRow,
  PublicCourseDetails,
  PublicModuleWithLessons,
  PublicLesson,
} from "@/types/database";

/**
 * Student Server Actions
 * ======================
 * Actions for student-facing pages: Storefront and Learning Portal.
 * Security: Enrollment checks are explicit. Public data never exposes
 * content or video_url to prevent API sniffing.
 */

// ── GET PUBLIC COURSE BY SLUG ─────────────────────────────────────────────

/**
 * Fetch course details for the public storefront page.
 * Returns modules + lessons but STRIPS sensitive fields (content, video_url).
 *
 * @param tenantSlug - The tenant subdomain slug
 * @param courseSlug - The course slug
 */
export async function getPublicCourseBySlug(
  tenantSlug: string,
  courseSlug: string,
): Promise<ActionResult<PublicCourseDetails>> {
  try {
    const supabase = await createClient();

    // 1. Find the tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, owner_id")
      .eq("subdomain", tenantSlug)
      .single();

    if (!tenant) {
      return { success: false, error: "Không tìm thấy học viện." };
    }

    // 2. Fetch the published course belonging to this tenant
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select(`
        id, title, slug, description, thumbnail_url,
        price, currency, status, lessons_count, enrollments_count, tenant_id,
        teacher:profiles!courses_teacher_id_fkey (
          display_name, avatar_url, bio
        )
      `)
      .eq("slug", courseSlug)
      .eq("tenant_id", tenant.id)
      .eq("status", "published")
      .single();

    if (courseError || !course) {
      return { success: false, error: "Khóa học không tồn tại hoặc chưa được xuất bản." };
    }

    // 3. Fetch published modules
    const { data: modules } = await supabase
      .from("modules")
      .select("id, title, order_index, is_published")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    // 4. Fetch published lessons (SAFE fields only — no content, no video_url)
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, lesson_type, order_index, is_free_preview, video_duration, is_published, module_id")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    // 5. Map lessons into modules
    const modulesWithLessons: PublicModuleWithLessons[] = (modules || []).map(
      (mod) => ({
        ...mod,
        lessons: ((lessons || []) as (PublicLesson & { module_id: string })[])
          .filter((l) => l.module_id === mod.id)
          .map(({ module_id: _mid, ...rest }) => rest),
      }),
    );

    const result: PublicCourseDetails = {
      ...(course as any),
      teacher: Array.isArray(course.teacher) ? course.teacher[0] || null : course.teacher,
      modules: modulesWithLessons,
    };

    return { success: true, data: result };
  } catch {
    return { success: false, error: "Không thể tải thông tin khóa học." };
  }
}

// ── CHECK ENROLLMENT ──────────────────────────────────────────────────────

async function checkEnrollment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", userId)
    .eq("course_id", courseId)
    .eq("payment_status", "completed")
    .maybeSingle();

  return !!data;
}

// ── GET LESSON CONTENT (SECURE) ───────────────────────────────────────────

/**
 * Fetch full lesson content. Security checks:
 *   1. If lesson.is_free_preview → return content (no enrollment required)
 *   2. Otherwise → check user has active enrollment
 *
 * Returns FULL lesson data including content and video_url.
 */
export async function getLessonContent(
  lessonId: string,
  courseId: string,
): Promise<ActionResult<LessonRow>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch lesson
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .eq("is_published", true)
      .single();

    if (error || !lesson) {
      return { success: false, error: "Bài học không tồn tại." };
    }

    const typedLesson = lesson as LessonRow;

    // Free preview → always allow
    if (typedLesson.is_free_preview) {
      return { success: true, data: typedLesson };
    }

    // Must be logged in
    if (!user) {
      return { success: false, error: "Bạn cần đăng nhập để xem bài học này." };
    }

    // Must be enrolled
    const enrolled = await checkEnrollment(supabase, user.id, courseId);
    if (!enrolled) {
      return { success: false, error: "Bạn chưa đăng ký khóa học này." };
    }

    return { success: true, data: typedLesson };
  } catch {
    return { success: false, error: "Không thể tải nội dung bài học." };
  }
}

// ── TOGGLE LESSON PROGRESS ────────────────────────────────────────────────

/**
 * Mark a lesson as completed or uncompleted.
 * Uses UPSERT on the unique (user_id, lesson_id) constraint.
 */
export async function toggleLessonProgress(
  lessonId: string,
  courseId: string,
  isCompleted: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Chưa đăng nhập." };

    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          course_id: courseId,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,lesson_id" },
      );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/learn`);
    return { success: true };
  } catch {
    return { success: false, error: "Không thể cập nhật tiến độ." };
  }
}

// ── GET COURSE PROGRESS ───────────────────────────────────────────────────

/**
 * Fetch all lesson_progress rows for the current user in a given course.
 * Used by the Learning Portal to render checkboxes + progress bar.
 */
export async function getCourseProgress(
  courseId: string,
): Promise<ActionResult<LessonProgressRow[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Chưa đăng nhập." };

    const { data, error } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as LessonProgressRow[] };
  } catch {
    return { success: false, error: "Không thể tải tiến độ." };
  }
}

// ── ENROLL FREE COURSE ────────────────────────────────────────────────────

/**
 * Enroll the current user in a free course (price = 0).
 * Inserts a row into enrollments with payment_status = 'completed'.
 * Rejects if course has a non-zero price.
 */
export async function enrollFreeCourse(
  courseId: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Bạn cần đăng nhập trước." };

    // Verify course is free
    const { data: course } = await supabase
      .from("courses")
      .select("id, price, status")
      .eq("id", courseId)
      .eq("status", "published")
      .single();

    if (!course) {
      return { success: false, error: "Khóa học không tồn tại." };
    }

    if (course.price > 0) {
      return { success: false, error: "Khóa học này không miễn phí." };
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existing) {
      return { success: true }; // Already enrolled
    }

    // Create enrollment
    const { error } = await supabase
      .from("enrollments")
      .insert({
        student_id: user.id,
        course_id: courseId,
        payment_status: "completed",
        payment_amount: 0,
        payment_provider: "free",
        payment_ref: `free_${Date.now()}`,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Không thể đăng ký khóa học." };
  }
}

// ── GET NEXT LESSON ID (Cross-module Navigation) ──────────────────────────

/**
 * Given the current lesson, find the next lesson in the course.
 * Handles cross-module navigation: if this is the last lesson in Module 1,
 * returns the first lesson of Module 2.
 *
 * Returns null if this is the very last lesson.
 */
export async function getNextLessonId(
  currentLessonId: string,
  courseId: string,
): Promise<string | null> {
  try {
    const supabase = await createClient();

    // Fetch all published modules + lessons, sorted
    const { data: modules } = await supabase
      .from("modules")
      .select("id, order_index")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, module_id, order_index")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (!modules || !lessons) return null;

    // Build flat ordered list: modules sorted by order_index,
    // each module's lessons sorted by order_index
    const flatList: string[] = [];
    for (const mod of modules) {
      const moduleLessons = lessons.filter((l) => l.module_id === mod.id);
      for (const l of moduleLessons) {
        flatList.push(l.id);
      }
    }

    const currentIndex = flatList.indexOf(currentLessonId);
    if (currentIndex === -1 || currentIndex >= flatList.length - 1) {
      return null; // Last lesson or not found
    }

    return flatList[currentIndex + 1];
  } catch {
    return null;
  }
}

// ── GET FIRST INCOMPLETE LESSON (Entry Point Helper) ──────────────────────

/**
 * Find the first uncompleted lesson for a student in a course.
 * Used by the Learning Portal entry point to redirect students
 * to where they left off.
 *
 * Returns the ID of the first lesson with no progress OR is_completed = false.
 * Falls back to the very first lesson if all are completed.
 */
export async function getFirstIncompleteLessonId(
  courseId: string,
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Get ordered flat lesson list
    const { data: modules } = await supabase
      .from("modules")
      .select("id, order_index")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, module_id, order_index")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (!modules || !lessons || lessons.length === 0) return null;

    // Build flat ordered list
    const flatList: string[] = [];
    for (const mod of modules) {
      const moduleLessons = lessons.filter((l) => l.module_id === mod.id);
      for (const l of moduleLessons) {
        flatList.push(l.id);
      }
    }

    if (flatList.length === 0) return null;

    // 2. Get completed lesson IDs
    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("is_completed", true);

    const completedIds = new Set((progress || []).map((p) => p.lesson_id));

    // 3. Find first uncompleted
    const firstIncomplete = flatList.find((id) => !completedIds.has(id));
    return firstIncomplete || flatList[0]; // If all done, go back to first
  } catch {
    return null;
  }
}
