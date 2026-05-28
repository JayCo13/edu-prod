"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { fanOutToTenantAdmins } from "@/app/actions/notifications";
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
  /** Optional — legacy courses model is deprecated (CLAUDE.md §4). Sessions
   *  can stand alone until the classes table lands. */
  course_id: z
    .string()
    .uuid("Khóa học không hợp lệ")
    .optional()
    .nullable(),
  start_time: z.string().min(1, "Thời gian bắt đầu không được để trống"),
  duration_minutes: z.number().int().min(5).max(480),
  meeting_url: z.string().max(2000),
  meeting_password: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional(),
  /** Teacher slot. Optional: for solo tenants, falls back to the caller's slot. */
  teacher_id: z.string().uuid("Giáo viên không hợp lệ").optional().nullable(),
  /** Classification: 'recurring' = long-term, 'one_off' = one-time. */
  kind: z.enum(["recurring", "one_off"]).default("one_off"),
  /** Number of weeks to fan out when kind='recurring'. Ignored for one-off. 1–52. */
  recurrence_weeks: z.number().int().min(1).max(52).optional().nullable(),
});

function handleError<T = null>(err: unknown): ActionResult<T> {
  const message =
    err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

// Used by updateLiveSession — all fields optional so the admin can patch
// a subset. Single-instance update only; does not propagate across series.
const updateSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  start_time: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  teacher_id: z.string().uuid().optional().nullable(),
  is_cancelled: z.boolean().optional(),
});

// ── TEACHER: Schedule Live Session ────────────────────────────────────────

export async function scheduleLiveSession(
  data: z.infer<typeof createSessionSchema>,
): Promise<ActionResult<LiveSessionRow>> {
  try {
    const parsed = createSessionSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, tenant, userId, currentTeacherId, isAdmin } =
      await getCurrentTenantContext();

    // Course is optional. Verify ownership only when one was actually picked.
    let course: { id: string; title: string } | null = null;
    if (parsed.data.course_id) {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", parsed.data.course_id)
        .eq("tenant_id", tenant.id)
        .single();
      if (!data) {
        return { success: false, error: "Khóa học không thuộc tài khoản của bạn." };
      }
      course = data as { id: string; title: string };
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

    // For 'recurring', fan out N weekly instances sharing a series_id.
    // For 'one_off', insert a single row (series_id stays NULL).
    const isRecurring = parsed.data.kind === "recurring";
    const weeks = isRecurring ? (parsed.data.recurrence_weeks ?? 1) : 1;
    const seriesId = isRecurring ? crypto.randomUUID() : null;
    const baseStart = new Date(parsed.data.start_time);

    const rows = Array.from({ length: weeks }, (_, i) => {
      const start = new Date(baseStart);
      start.setDate(baseStart.getDate() + i * 7);
      return {
        tenant_id: tenant.id,
        course_id: parsed.data.course_id ?? null,
        teacher_id: teacherId,
        title: parsed.data.title,
        description: parsed.data.description || "",
        start_time: start.toISOString(),
        duration_minutes: parsed.data.duration_minutes,
        meeting_url: parsed.data.meeting_url,
        meeting_password: parsed.data.meeting_password || null,
        kind: parsed.data.kind,
        series_id: seriesId,
        recurrence_weeks: isRecurring ? weeks : null,
      };
    });

    const { data: inserted, error } = await supabase
      .from("live_sessions")
      .insert(rows)
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/calendar");
    // Return the first instance (the original start_time the admin picked).
    // Callers that need the whole series can re-query by series_id.
    const first = (inserted ?? [])[0] as LiveSessionRow | undefined;
    if (!first) {
      return { success: false, error: "Không tạo được buổi học." };
    }

    // Notify admins when a non-admin teacher schedules. Admins acting on
    // their own tenant don't need to ping themselves. Best-effort — never
    // block the success return on notification fan-out.
    if (!isAdmin) {
      const { data: actorSlot } = await supabase
        .from("tenant_teachers")
        .select("display_name")
        .eq("id", teacherId)
        .maybeSingle();
      void fanOutToTenantAdmins({
        tenantId: tenant.id,
        actorUserId: userId,
        actorTeacherId: teacherId,
        kind: "session_created",
        entityType: "live_session",
        entityId: first.id,
        payload: {
          title: first.title,
          start_time: first.start_time,
          course_title: course?.title ?? null,
          actor_display_name: actorSlot?.display_name ?? null,
          series_count: isRecurring ? weeks : null,
        },
      }).catch(() => {});
    }

    return { success: true, data: first };
  } catch (err) {
    return handleError<LiveSessionRow>(err);
  }
}

// ── TEACHER: Get All Sessions ─────────────────────────────────────────────

export type TeacherSessionRow = LiveSessionRow & {
  /** NULL when the session isn't linked to a course (course_id IS NULL).
   *  Sessions decoupled from the deprecated courses model per migration 0021. */
  course:
    | (Pick<CourseRow, "title" | "slug"> & {
        enrollments_count: number | null;
      })
    | null;
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

// ── ADMIN: Update Single Live Session ─────────────────────────────────────
//
// Single-instance update only. For sessions in a recurring series the change
// affects ONLY the targeted row — series-aware edit ("apply to all upcoming")
// is deferred to the Classes module (PRD §6).

export async function updateLiveSession(
  data: z.infer<typeof updateSessionSchema>,
): Promise<ActionResult<LiveSessionRow>> {
  try {
    const parsed = updateSessionSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, tenant, userId, currentTeacherId, isAdmin } =
      await getCurrentTenantContext();

    // Non-admins can only re-assign to themselves (or leave unchanged).
    // Final enforcement is RLS (own-teacher-write policy); this is a clearer
    // error message before we hit the database.
    if (
      !isAdmin &&
      parsed.data.teacher_id !== undefined &&
      parsed.data.teacher_id !== currentTeacherId
    ) {
      return {
        success: false,
        error: "Bạn chỉ có thể giữ buổi học của mình.",
      };
    }

    // If teacher_id is being changed, verify the new slot belongs to this tenant.
    if (parsed.data.teacher_id) {
      const { data: teacherRow } = await supabase
        .from("tenant_teachers")
        .select("id")
        .eq("id", parsed.data.teacher_id)
        .eq("tenant_id", tenant.id)
        .single();
      if (!teacherRow) {
        return { success: false, error: "Giáo viên không thuộc trung tâm này." };
      }
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      patch.description = parsed.data.description;
    if (parsed.data.start_time !== undefined)
      patch.start_time = parsed.data.start_time;
    if (parsed.data.duration_minutes !== undefined)
      patch.duration_minutes = parsed.data.duration_minutes;
    if (parsed.data.teacher_id !== undefined)
      patch.teacher_id = parsed.data.teacher_id;
    if (parsed.data.is_cancelled !== undefined)
      patch.is_cancelled = parsed.data.is_cancelled;
    patch.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("live_sessions")
      .update(patch)
      .eq("id", parsed.data.id)
      .eq("tenant_id", tenant.id)
      .select(
        `*, course:courses!live_sessions_course_id_fkey (title)`,
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/calendar");

    // Notify admins when a non-admin teacher edits a session. Cancel uses a
    // separate kind so the bell copy can read "Đã huỷ" instead of "Đã sửa".
    if (!isAdmin) {
      const row = updated as LiveSessionRow & {
        course?: { title?: string | null } | null;
      };
      const isCancelEvent = parsed.data.is_cancelled === true;
      const { data: actorSlot } = await supabase
        .from("tenant_teachers")
        .select("display_name")
        .eq("id", currentTeacherId ?? "")
        .maybeSingle();
      void fanOutToTenantAdmins({
        tenantId: tenant.id,
        actorUserId: userId,
        actorTeacherId: currentTeacherId,
        kind: isCancelEvent ? "session_cancelled" : "session_updated",
        entityType: "live_session",
        entityId: row.id,
        payload: {
          title: row.title,
          start_time: row.start_time,
          course_title: row.course?.title ?? null,
          actor_display_name: actorSlot?.display_name ?? null,
        },
      }).catch(() => {});
    }

    return { success: true, data: updated as LiveSessionRow };
  } catch (err) {
    return handleError<LiveSessionRow>(err);
  }
}

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
