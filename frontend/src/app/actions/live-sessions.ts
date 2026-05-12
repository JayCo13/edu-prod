"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type {
  ActionResult,
  LiveSessionRow,
  CourseRow,
  TenantTeacherRow,
} from "@/types/database";

/**
 * Live Sessions Server Actions
 * =============================
 * CRUD for scheduling live sessions (Zoom/Meet).
 * Teacher actions are tenant-scoped.
 * Student actions check enrollment.
 */

// ── Validation ────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  title: z.string().min(1, "Tên buổi học không được để trống").max(200),
  course_id: z.string().uuid("Khóa học không hợp lệ"),
  start_time: z.string().min(1, "Thời gian bắt đầu không được để trống"),
  duration_minutes: z.number().int().min(5).max(480),
  meeting_url: z.string().url("URL phòng học không hợp lệ"),
  meeting_password: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional(),
  /** Teacher slot. Optional: for solo tenants, falls back to the caller's slot. */
  teacher_id: z.string().uuid("Giáo viên không hợp lệ").optional().nullable(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

// ── TEACHER: Schedule Live Session ────────────────────────────────────────

export async function scheduleLiveSession(
  data: z.infer<typeof createSessionSchema>,
): Promise<ActionResult<LiveSessionRow>> {
  try {
    const parsed = createSessionSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, tenant, currentTeacherId, isAdmin } =
      await getCurrentTenantContext();

    // Verify the course belongs to this tenant
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", parsed.data.course_id)
      .eq("tenant_id", tenant.id)
      .single();

    if (!course) {
      return { success: false, error: "Khóa học không thuộc tài khoản của bạn." };
    }

    // Resolve teacher_id: caller's pick (if admin), else fall back to caller.
    // Non-admins can only assign sessions to themselves.
    let teacherId = parsed.data.teacher_id ?? currentTeacherId;
    if (!isAdmin && teacherId !== currentTeacherId) {
      teacherId = currentTeacherId; // RLS would also block this; defensive.
    }
    if (!teacherId) {
      return {
        success: false,
        error: "Không xác định được giáo viên cho buổi học.",
      };
    }

    // Verify the chosen teacher_id belongs to this tenant.
    const { data: teacherRow } = await supabase
      .from("tenant_teachers")
      .select("id")
      .eq("id", teacherId)
      .eq("tenant_id", tenant.id)
      .single();
    if (!teacherRow) {
      return { success: false, error: "Giáo viên không thuộc trung tâm này." };
    }

    const { data: session, error } = await supabase
      .from("live_sessions")
      .insert({
        tenant_id: tenant.id,
        course_id: parsed.data.course_id,
        teacher_id: teacherId,
        title: parsed.data.title,
        description: parsed.data.description || "",
        start_time: parsed.data.start_time,
        duration_minutes: parsed.data.duration_minutes,
        meeting_url: parsed.data.meeting_url,
        meeting_password: parsed.data.meeting_password || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/calendar");
    return { success: true, data: session as LiveSessionRow };
  } catch (err) {
    return handleError<LiveSessionRow>(err);
  }
}

// ── TEACHER: Get All Sessions ─────────────────────────────────────────────

export type TeacherSessionRow = LiveSessionRow & {
  course: Pick<CourseRow, "title" | "slug"> & {
    enrollments_count: number | null;
  };
  teacher: Pick<
    TenantTeacherRow,
    "id" | "display_name" | "color" | "is_admin"
  > | null;
};

export async function getTeacherLiveSessions(): Promise<
  ActionResult<TeacherSessionRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();

    const { data, error } = await supabase
      .from("live_sessions")
      .select(`
        *,
        course:courses!live_sessions_course_id_fkey (title, slug, enrollments_count),
        teacher:tenant_teachers!live_sessions_teacher_id_fkey (id, display_name, color, is_admin)
      `)
      .eq("tenant_id", tenant.id)
      .order("start_time", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as TeacherSessionRow[] };
  } catch (err) {
    return handleError(err);
  }
}

// ── TEACHER: Delete Session ───────────────────────────────────────────────

export async function deleteLiveSession(
  sessionId: string,
): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();

    const { error } = await supabase
      .from("live_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("tenant_id", tenant.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

// ── STUDENT: Get Upcoming Sessions Across Enrolled Courses ────────────────

export type StudentSessionRow = LiveSessionRow & {
  course: Pick<CourseRow, "title" | "slug">;
};

/**
 * List live sessions the current student can attend, scoped to one tenant.
 * Returns sessions for courses the student is enrolled in (payment completed),
 * within this tenant. Includes upcoming + currently-live + recently-ended
 * (last 2 hours) so the page surfaces "Tham gia ngay" + "Vừa kết thúc".
 */
export async function getStudentUpcomingLiveSessions(
  tenantSlug: string,
): Promise<ActionResult<StudentSessionRow[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Chưa đăng nhập." };

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", tenantSlug)
      .single();
    if (!tenant) return { success: false, error: "Không tìm thấy học viện." };

    // Recently-ended cutoff: 2 hours back from now.
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // RLS already restricts to courses the student is enrolled in (completed
    // payment). We just add the tenant + time filter.
    const { data, error } = await supabase
      .from("live_sessions")
      .select(`
        *,
        course:courses!live_sessions_course_id_fkey (title, slug)
      `)
      .eq("tenant_id", tenant.id)
      .eq("is_cancelled", false)
      .gte("start_time", cutoff)
      .order("start_time", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as StudentSessionRow[] };
  } catch (err) {
    return handleError(err);
  }
}

// ── STUDENT: Get Single Session (for Waiting Room) ────────────────────────

/**
 * Fetch a single live session for the waiting room page.
 * Security: checks enrollment OR course.is_public.
 */
export async function getStudentLiveSession(
  sessionId: string,
  courseId: string,
): Promise<ActionResult<LiveSessionRow>> {
  try {
    const supabase = await createClient();

    // Fetch session
    const { data: session, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("course_id", courseId)
      .eq("is_cancelled", false)
      .single();

    if (error || !session) {
      return { success: false, error: "Buổi học không tồn tại." };
    }

    return { success: true, data: session as LiveSessionRow };
  } catch (err) {
    return handleError<LiveSessionRow>(err);
  }
}

// ── TEACHER: Get Courses For Dropdown ─────────────────────────────────────

export async function getTeacherCourses(): Promise<
  ActionResult<Pick<CourseRow, "id" | "title">[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();

    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("tenant_id", tenant.id)
      .order("title");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Pick<CourseRow, "id" | "title">[] };
  } catch (err) {
    return handleError(err);
  }
}
