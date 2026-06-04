"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

export interface ClassRow {
  id: string;
  tenant_id: string;
  name: string;
  grade_level: number | null;
  year_label: string;
  homeroom_teacher_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassWithCount extends ClassRow {
  active_student_count: number;
}

function err(e: unknown): ActionResult<never> {
  return {
    success: false,
    error: e instanceof Error ? e.message : "Lỗi không xác định.",
  };
}

async function requireAdmin() {
  const ctx = await getCurrentTenantContext();
  if (!ctx.isAdmin) throw new Error("Chỉ quản trị viên có quyền.");
  return ctx;
}

const ClassSchema = z.object({
  name: z.string().trim().min(1, "Tên lớp bắt buộc").max(100),
  grade_level: z.number().int().min(1).max(12).nullable().optional(),
  year_label: z.string().trim().max(50).optional().default(""),
  homeroom_teacher_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type ClassInput = z.input<typeof ClassSchema>;

export async function listClasses(opts?: {
  includeInactive?: boolean;
  withStudentCount?: boolean;
}): Promise<ActionResult<ClassRow[] | ClassWithCount[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    let q = supabase
      .from("classes")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("name");
    if (!opts?.includeInactive) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    const rows = (data ?? []) as ClassRow[];

    if (!opts?.withStudentCount) return { success: true, data: rows };

    // Đếm HS ACTIVE per class
    const classIds = rows.map((c) => c.id);
    if (classIds.length === 0) return { success: true, data: [] };

    const { data: enrs } = await supabase
      .from("student_enrollments")
      .select("class_id")
      .eq("tenant_id", tenant.id)
      .eq("status", "ACTIVE")
      .in("class_id", classIds);
    const counts = new Map<string, number>();
    for (const e of (enrs ?? []) as Array<{ class_id: string }>) {
      counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1);
    }
    const withCount: ClassWithCount[] = rows.map((c) => ({
      ...c,
      active_student_count: counts.get(c.id) ?? 0,
    }));
    return { success: true, data: withCount };
  } catch (e) {
    return err(e);
  }
}

export async function getClass(id: string): Promise<ActionResult<ClassRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .single();
    if (error || !data) return { success: false, error: error?.message ?? "Lớp không tồn tại." };
    return { success: true, data: data as ClassRow };
  } catch (e) {
    return err(e);
  }
}

export async function createClass(input: ClassInput): Promise<ActionResult<ClassRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = ClassSchema.parse(input);
    const { data, error } = await supabase
      .from("classes")
      .insert({
        tenant_id: tenant.id,
        name: parsed.name,
        grade_level: parsed.grade_level ?? null,
        year_label: parsed.year_label ?? "",
        homeroom_teacher_id: parsed.homeroom_teacher_id ?? null,
        is_active: parsed.is_active ?? true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Lớp "${parsed.name}" đã tồn tại trong năm "${parsed.year_label ?? ""}".` };
      }
      return { success: false, error: error.message };
    }
    revalidatePath("/dashboard/classes");
    return { success: true, data: data as ClassRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateClass(
  id: string,
  input: ClassInput,
): Promise<ActionResult<ClassRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = ClassSchema.parse(input);
    const patch: Record<string, unknown> = {
      name: parsed.name,
      grade_level: parsed.grade_level ?? null,
      year_label: parsed.year_label ?? "",
      homeroom_teacher_id: parsed.homeroom_teacher_id ?? null,
    };
    if (parsed.is_active !== undefined) patch.is_active = parsed.is_active;
    const { data, error } = await supabase
      .from("classes")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/classes");
    return { success: true, data: data as ClassRow };
  } catch (e) {
    return err(e);
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    // Nếu lớp có enrollment ACTIVE → từ chối xoá cứng, chỉ deactivate.
    const { count } = await supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("tenant_id", tenant.id)
      .eq("status", "ACTIVE");
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: `Không thể xoá: lớp đang có ${count} học sinh đang học. Hãy chuyển/cho nghỉ các HS trước.`,
      };
    }
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) {
      // Foreign key (timetable_slots, live_sessions) → soft delete.
      const { error: softErr } = await supabase
        .from("classes")
        .update({ is_active: false })
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (softErr) return { success: false, error: softErr.message };
    }
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ══ CLASS TEACHERS (gán GV vào lớp) ════════════════════════════════════

export type ClassTeacherRole = "PRIMARY" | "ASSISTANT";

export interface ClassTeacherRow {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string;
  role: ClassTeacherRole;
  assigned_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassTeacherWithProfile extends ClassTeacherRow {
  teacher: {
    id: string;
    display_name: string;
    profile_id: string | null;
    is_active: boolean;
  };
}

export async function listClassTeachers(
  classId: string,
): Promise<ActionResult<ClassTeacherWithProfile[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("class_teachers")
      .select(
        "id, tenant_id, class_id, teacher_id, role, assigned_at, note, created_at, updated_at, teacher:tenant_teachers!class_teachers_teacher_id_fkey(id, display_name, profile_id, is_active)",
      )
      .eq("tenant_id", tenant.id)
      .eq("class_id", classId);
    if (error) return { success: false, error: error.message };

    // PostgREST embed trả teacher như object 1:1 (do FK đơn). Sort
    // client: PRIMARY trước, sau đó theo display_name.
    const rows = (data ?? []) as unknown as ClassTeacherWithProfile[];
    rows.sort((a, b) => {
      if (a.role !== b.role) return a.role === "PRIMARY" ? -1 : 1;
      return a.teacher.display_name.localeCompare(b.teacher.display_name);
    });
    return { success: true, data: rows };
  } catch (e) {
    return err(e);
  }
}

const AssignTeacherSchema = z.object({
  class_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
  role: z.enum(["PRIMARY", "ASSISTANT"]).default("PRIMARY"),
  note: z.string().max(500).optional().nullable(),
  // Khi gán PRIMARY mới, có replace primary cũ + update future sessions
  // không. Mặc định true để admin không cần config.
  replace_existing_primary: z.boolean().default(true),
});

export type AssignTeacherInput = z.input<typeof AssignTeacherSchema>;

// Backfill teacher_id cho các buổi tương lai của lớp.
// Áp dụng khi:
//   • Gán PRIMARY mới → update sessions có teacher_id = old primary
//     hoặc NULL → set thành new primary.
//   • Đổi role PRIMARY ↔ ASSISTANT (xử riêng bên updateClassTeacherRole).
//
// Chỉ touch buổi start_time >= now → giữ lịch sử lương + điểm danh.
async function backfillFutureSessionTeacher(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tenantId: string,
  classId: string,
  newTeacherId: string,
  oldPrimaryId: string | null,
): Promise<number> {
  // Filter: sessions của lớp + tương lai + (teacher_id IS NULL OR
  // teacher_id = old primary). Không động vào buổi đã có teacher khác
  // (vd. dạy thay).
  const nowIso = new Date().toISOString();
  let q = supabase
    .from("live_sessions")
    .update({ teacher_id: newTeacherId }, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .gte("start_time", nowIso);
  if (oldPrimaryId) {
    q = q.or(`teacher_id.is.null,teacher_id.eq.${oldPrimaryId}`);
  } else {
    q = q.is("teacher_id", null);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function assignTeacherToClass(
  input: AssignTeacherInput,
): Promise<
  ActionResult<{
    row: ClassTeacherWithProfile;
    sessions_updated: number;
    replaced_primary: { teacher_id: string; display_name: string } | null;
  }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = AssignTeacherSchema.parse(input);

    // Verify class + teacher cùng tenant
    const [{ data: cls }, { data: tt }] = await Promise.all([
      supabase
        .from("classes")
        .select("id")
        .eq("id", parsed.class_id)
        .eq("tenant_id", tenant.id)
        .single(),
      supabase
        .from("tenant_teachers")
        .select("id, display_name")
        .eq("id", parsed.teacher_id)
        .eq("tenant_id", tenant.id)
        .single(),
    ]);
    if (!cls) return { success: false, error: "Lớp không tồn tại trong trung tâm." };
    if (!tt) return { success: false, error: "Giáo viên không tồn tại trong trung tâm." };

    // GV này đã trong lớp chưa
    const { data: existing } = await supabase
      .from("class_teachers")
      .select("id, role")
      .eq("class_id", parsed.class_id)
      .eq("teacher_id", parsed.teacher_id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        error: `Giáo viên đã trong lớp này rồi (${(existing as { role: string }).role === "PRIMARY" ? "GV chính" : "Trợ giảng"}). Đổi role qua nút sửa.`,
      };
    }

    let replacedPrimary: { teacher_id: string; display_name: string } | null = null;
    let oldPrimaryId: string | null = null;

    // Nếu gán PRIMARY và đã có PRIMARY khác → cần xử lý
    if (parsed.role === "PRIMARY") {
      const { data: curPrimary } = await supabase
        .from("class_teachers")
        .select("id, teacher_id, teacher:tenant_teachers!class_teachers_teacher_id_fkey(display_name)")
        .eq("class_id", parsed.class_id)
        .eq("tenant_id", tenant.id)
        .eq("role", "PRIMARY")
        .maybeSingle();
      if (curPrimary) {
        if (!parsed.replace_existing_primary) {
          return {
            success: false,
            error: "Lớp đã có giáo viên chính. Chuyển GV cũ thành trợ giảng trước.",
          };
        }
        // Demote PRIMARY cũ → ASSISTANT
        const row = curPrimary as unknown as {
          id: string;
          teacher_id: string;
          teacher: { display_name: string };
        };
        const { error: demoteErr } = await supabase
          .from("class_teachers")
          .update({ role: "ASSISTANT" })
          .eq("id", row.id)
          .eq("tenant_id", tenant.id);
        if (demoteErr) {
          return { success: false, error: demoteErr.message };
        }
        oldPrimaryId = row.teacher_id;
        replacedPrimary = {
          teacher_id: row.teacher_id,
          display_name: row.teacher.display_name,
        };
      }
    }

    // Insert assignment mới
    const { data: inserted, error: insErr } = await supabase
      .from("class_teachers")
      .insert({
        tenant_id: tenant.id,
        class_id: parsed.class_id,
        teacher_id: parsed.teacher_id,
        role: parsed.role,
        note: parsed.note ?? null,
      })
      .select(
        "id, tenant_id, class_id, teacher_id, role, assigned_at, note, created_at, updated_at, teacher:tenant_teachers!class_teachers_teacher_id_fkey(id, display_name, profile_id, is_active)",
      )
      .single();
    if (insErr) return { success: false, error: insErr.message };

    // Backfill future sessions nếu là PRIMARY
    let sessionsUpdated = 0;
    if (parsed.role === "PRIMARY") {
      sessionsUpdated = await backfillFutureSessionTeacher(
        supabase,
        tenant.id,
        parsed.class_id,
        parsed.teacher_id,
        oldPrimaryId,
      );
    }

    revalidatePath(`/dashboard/classes/${parsed.class_id}`);
    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      data: {
        row: inserted as unknown as ClassTeacherWithProfile,
        sessions_updated: sessionsUpdated,
        replaced_primary: replacedPrimary,
      },
    };
  } catch (e) {
    return err(e);
  }
}

export async function updateClassTeacherRole(input: {
  class_teacher_id: string;
  new_role: ClassTeacherRole;
}): Promise<
  ActionResult<{ sessions_updated: number; demoted_primary: string | null }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();

    // Lấy row hiện tại
    const { data: cur, error: curErr } = await supabase
      .from("class_teachers")
      .select("id, class_id, teacher_id, role")
      .eq("id", input.class_teacher_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (curErr || !cur) return { success: false, error: "Không tìm thấy assignment." };

    const current = cur as { id: string; class_id: string; teacher_id: string; role: string };
    if (current.role === input.new_role) {
      return { success: true, data: { sessions_updated: 0, demoted_primary: null } };
    }

    let sessionsUpdated = 0;
    let demotedPrimary: string | null = null;

    if (input.new_role === "PRIMARY") {
      // Promote ASSISTANT → PRIMARY. Demote PRIMARY hiện tại nếu có.
      const { data: existingPrimary } = await supabase
        .from("class_teachers")
        .select("id, teacher_id")
        .eq("class_id", current.class_id)
        .eq("tenant_id", tenant.id)
        .eq("role", "PRIMARY")
        .neq("id", current.id)
        .maybeSingle();
      let oldPrimaryId: string | null = null;
      if (existingPrimary) {
        const p = existingPrimary as { id: string; teacher_id: string };
        oldPrimaryId = p.teacher_id;
        demotedPrimary = p.id;
        const { error: demoteErr } = await supabase
          .from("class_teachers")
          .update({ role: "ASSISTANT" })
          .eq("id", p.id)
          .eq("tenant_id", tenant.id);
        if (demoteErr) return { success: false, error: demoteErr.message };
      }
      // Promote
      const { error: promErr } = await supabase
        .from("class_teachers")
        .update({ role: "PRIMARY" })
        .eq("id", current.id)
        .eq("tenant_id", tenant.id);
      if (promErr) return { success: false, error: promErr.message };

      sessionsUpdated = await backfillFutureSessionTeacher(
        supabase,
        tenant.id,
        current.class_id,
        current.teacher_id,
        oldPrimaryId,
      );
    } else {
      // PRIMARY → ASSISTANT. Buổi tương lai có teacher_id = self thì clear
      // về NULL (để admin gán PRIMARY mới sau).
      const { error: demoteErr } = await supabase
        .from("class_teachers")
        .update({ role: "ASSISTANT" })
        .eq("id", current.id)
        .eq("tenant_id", tenant.id);
      if (demoteErr) return { success: false, error: demoteErr.message };

      const nowIso = new Date().toISOString();
      const { count } = await supabase
        .from("live_sessions")
        .update({ teacher_id: null }, { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("class_id", current.class_id)
        .eq("teacher_id", current.teacher_id)
        .gte("start_time", nowIso);
      sessionsUpdated = count ?? 0;
    }

    revalidatePath(`/dashboard/classes/${current.class_id}`);
    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      data: { sessions_updated: sessionsUpdated, demoted_primary: demotedPrimary },
    };
  } catch (e) {
    return err(e);
  }
}

export async function removeTeacherFromClass(input: {
  class_teacher_id: string;
  also_clear_future_sessions?: boolean;
}): Promise<ActionResult<{ sessions_cleared: number }>> {
  try {
    const { supabase, tenant } = await requireAdmin();

    const { data: cur } = await supabase
      .from("class_teachers")
      .select("id, class_id, teacher_id, role")
      .eq("id", input.class_teacher_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cur) return { success: false, error: "Không tìm thấy assignment." };
    const current = cur as { id: string; class_id: string; teacher_id: string; role: string };

    // Clear future sessions của GV này nếu user yêu cầu HOẶC là PRIMARY
    // (PRIMARY đi rồi để teacher_id NULL cho admin gán mới sau).
    let sessionsCleared = 0;
    if (input.also_clear_future_sessions || current.role === "PRIMARY") {
      const nowIso = new Date().toISOString();
      const { count } = await supabase
        .from("live_sessions")
        .update({ teacher_id: null }, { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("class_id", current.class_id)
        .eq("teacher_id", current.teacher_id)
        .gte("start_time", nowIso);
      sessionsCleared = count ?? 0;
    }

    const { error: delErr } = await supabase
      .from("class_teachers")
      .delete()
      .eq("id", input.class_teacher_id)
      .eq("tenant_id", tenant.id);
    if (delErr) return { success: false, error: delErr.message };

    revalidatePath(`/dashboard/classes/${current.class_id}`);
    revalidatePath("/dashboard/calendar");
    return { success: true, data: { sessions_cleared: sessionsCleared } };
  } catch (e) {
    return err(e);
  }
}

// List teachers của tenant — dùng cho dropdown trong AssignTeacherDialog
export interface SimpleTeacher {
  id: string;
  display_name: string;
  is_active: boolean;
}

// ══ GV-side: lớp của tôi ═══════════════════════════════════════════════
// Không gate qua requireAdmin — GV cần đọc. Tự tìm currentTeacherId của
// caller qua getCurrentTenantContext.
export interface MyClassRow {
  class_id: string;
  class_name: string;
  grade_level: number | null;
  year_label: string;
  my_role: ClassTeacherRole;
  active_student_count: number;
  next_session: {
    id: string;
    title: string;
    start_time: string;
    duration_minutes: number;
  } | null;
  total_upcoming_sessions: number;
}

export async function listMyTeacherClasses(): Promise<
  ActionResult<MyClassRow[]>
> {
  try {
    const ctx = await getCurrentTenantContext();
    if (!ctx.currentTeacherId) {
      return {
        success: false,
        error: "Tài khoản chưa được link với teacher slot trong trung tâm.",
      };
    }
    const { supabase, tenant, currentTeacherId } = ctx;

    const { data: assigns, error: assignErr } = await supabase
      .from("class_teachers")
      .select(
        "class_id, role, class:classes!class_teachers_class_id_fkey(id, name, grade_level, year_label, is_active)",
      )
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", currentTeacherId);
    if (assignErr) return { success: false, error: assignErr.message };

    type AssignRaw = {
      class_id: string;
      role: ClassTeacherRole;
      class: {
        id: string;
        name: string;
        grade_level: number | null;
        year_label: string;
        is_active: boolean;
      } | null;
    };
    const list = (assigns ?? []) as unknown as AssignRaw[];
    const activeClasses = list.filter((a) => a.class?.is_active);
    if (activeClasses.length === 0) return { success: true, data: [] };

    const classIds = activeClasses.map((a) => a.class_id);
    const nowIso = new Date().toISOString();

    // 1 query: next upcoming session per class — ORDER + LIMIT 200 +
    // group ở client. Đủ nhanh cho trung tâm size MVP (<100 lớp/GV).
    const { data: sessions } = await supabase
      .from("live_sessions")
      .select("id, class_id, title, start_time, duration_minutes")
      .eq("tenant_id", tenant.id)
      .in("class_id", classIds)
      .gte("start_time", nowIso)
      .eq("is_cancelled", false)
      .order("start_time", { ascending: true })
      .limit(200);

    const nextByClass = new Map<
      string,
      { id: string; title: string; start_time: string; duration_minutes: number }
    >();
    const countByClass = new Map<string, number>();
    for (const s of (sessions ?? []) as Array<{
      id: string;
      class_id: string;
      title: string;
      start_time: string;
      duration_minutes: number;
    }>) {
      countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
      if (!nextByClass.has(s.class_id)) {
        nextByClass.set(s.class_id, {
          id: s.id,
          title: s.title,
          start_time: s.start_time,
          duration_minutes: s.duration_minutes,
        });
      }
    }

    // Student counts per class
    const { data: enrs } = await supabase
      .from("student_enrollments")
      .select("class_id")
      .eq("tenant_id", tenant.id)
      .eq("status", "ACTIVE")
      .in("class_id", classIds);
    const studentCount = new Map<string, number>();
    for (const e of (enrs ?? []) as Array<{ class_id: string }>) {
      studentCount.set(e.class_id, (studentCount.get(e.class_id) ?? 0) + 1);
    }

    const out: MyClassRow[] = activeClasses
      .filter((a) => a.class !== null)
      .map((a) => ({
        class_id: a.class_id,
        class_name: a.class!.name,
        grade_level: a.class!.grade_level,
        year_label: a.class!.year_label,
        my_role: a.role,
        active_student_count: studentCount.get(a.class_id) ?? 0,
        next_session: nextByClass.get(a.class_id) ?? null,
        total_upcoming_sessions: countByClass.get(a.class_id) ?? 0,
      }));

    // Sort: lớp có buổi gần nhất trước, lớp không có buổi đẩy cuối
    out.sort((a, b) => {
      if (a.next_session && b.next_session) {
        return a.next_session.start_time.localeCompare(b.next_session.start_time);
      }
      if (a.next_session) return -1;
      if (b.next_session) return 1;
      return a.class_name.localeCompare(b.class_name);
    });

    return { success: true, data: out };
  } catch (e) {
    return err(e);
  }
}

// GV xem các buổi sắp tới của mình (cross-classes) — dùng cho calendar
// view nếu cần extend, hoặc widget dashboard. Limit 50 buổi tới.
export interface MyUpcomingSession {
  id: string;
  class_id: string | null;
  class_name: string | null;
  title: string;
  start_time: string;
  duration_minutes: number;
  is_cancelled: boolean;
}

export async function listMyUpcomingSessions(
  limit = 20,
): Promise<ActionResult<MyUpcomingSession[]>> {
  try {
    const ctx = await getCurrentTenantContext();
    if (!ctx.currentTeacherId) {
      return { success: true, data: [] };
    }
    const { supabase, tenant, currentTeacherId } = ctx;
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("live_sessions")
      .select(
        "id, class_id, title, start_time, duration_minutes, is_cancelled, class:classes!live_sessions_class_id_fkey(name)",
      )
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", currentTeacherId)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(limit);
    if (error) return { success: false, error: error.message };

    type Raw = {
      id: string;
      class_id: string | null;
      title: string;
      start_time: string;
      duration_minutes: number;
      is_cancelled: boolean;
      class?: { name: string } | null;
    };
    const out: MyUpcomingSession[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
      id: r.id,
      class_id: r.class_id,
      class_name: r.class?.name ?? null,
      title: r.title,
      start_time: r.start_time,
      duration_minutes: r.duration_minutes,
      is_cancelled: r.is_cancelled,
    }));
    return { success: true, data: out };
  } catch (e) {
    return err(e);
  }
}

export async function listTenantTeachers(): Promise<
  ActionResult<SimpleTeacher[]>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("tenant_teachers")
      .select("id, display_name, is_active")
      .eq("tenant_id", tenant.id)
      .order("display_name");
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SimpleTeacher[] };
  } catch (e) {
    return err(e);
  }
}

// ══ CLASS SESSIONS (buổi học của lớp) ═════════════════════════════════
// Tạo live_sessions.class_id = class.id để hệ thống điểm danh + báo cáo
// gắn được. Không validate tenant.kind ở đây — đã require admin của
// tenant nắm class, đủ rồi.

const ClassSessionSchema = z.object({
  class_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  start_time: z.string(), // ISO timestamp đầy đủ "YYYY-MM-DDTHH:mm"
  duration_minutes: z.number().int().min(15).max(720).optional().default(90),
  description: z.string().max(1000).optional().default(""),
});

export type ClassSessionInput = z.input<typeof ClassSessionSchema>;

export interface ClassSessionRow {
  id: string;
  tenant_id: string;
  class_id: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  title: string;
  description: string | null;
  start_time: string;
  duration_minutes: number;
  is_cancelled: boolean;
}

// Helper: lấy PRIMARY teacher của lớp (nếu có).
async function getPrimaryTeacherId(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tenantId: string,
  classId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("class_teachers")
    .select("teacher_id")
    .eq("tenant_id", tenantId)
    .eq("class_id", classId)
    .eq("role", "PRIMARY")
    .maybeSingle();
  return (data as { teacher_id: string } | null)?.teacher_id ?? null;
}

export async function listSessionsForClass(input: {
  class_id: string;
  from?: string; // ISO date "YYYY-MM-DD"
  to?: string;
}): Promise<ActionResult<ClassSessionRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    let q = supabase
      .from("live_sessions")
      .select(
        "id, tenant_id, class_id, teacher_id, title, description, start_time, duration_minutes, is_cancelled, teacher:tenant_teachers!live_sessions_teacher_id_fkey(display_name)",
      )
      .eq("tenant_id", tenant.id)
      .eq("class_id", input.class_id)
      // Fetch ASC để dữ liệu có thứ tự ổn định; UI client sort lại
      // theo "upcoming gần nhất trước, đã qua thì mới nhất trước".
      .order("start_time", { ascending: true })
      .limit(200);
    if (input.from) q = q.gte("start_time", input.from);
    if (input.to) q = q.lt("start_time", input.to);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };

    // Sắp xếp: upcoming ASC (gần nhất trước), past DESC (mới qua trước).
    // Vd. hôm nay 2026-06-04 → 06-05, 06-07, 06-10, …, 06-03, 06-01.
    const now = Date.now();
    type RawRow = Omit<ClassSessionRow, "teacher_name"> & {
      teacher?: { display_name: string | null } | null;
    };
    const raw = (data ?? []) as unknown as RawRow[];
    const rows: ClassSessionRow[] = raw.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      class_id: r.class_id,
      teacher_id: r.teacher_id,
      title: r.title,
      description: r.description,
      start_time: r.start_time,
      duration_minutes: r.duration_minutes,
      is_cancelled: r.is_cancelled,
      teacher_name: r.teacher?.display_name ?? null,
    }));
    rows.sort((a, b) => {
      const ta = new Date(a.start_time).getTime();
      const tb = new Date(b.start_time).getTime();
      const aFut = ta >= now;
      const bFut = tb >= now;
      if (aFut && !bFut) return -1;
      if (!aFut && bFut) return 1;
      if (aFut && bFut) return ta - tb; // upcoming ASC
      return tb - ta; // past DESC
    });
    return { success: true, data: rows };
  } catch (e) {
    return err(e);
  }
}

export async function createClassSession(
  input: ClassSessionInput,
): Promise<ActionResult<ClassSessionRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = ClassSessionSchema.parse(input);

    // Verify class thuộc tenant.
    const { data: cls } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", parsed.class_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cls) return { success: false, error: "Lớp không tồn tại trong trung tâm." };

    // Inherit teacher_id từ PRIMARY của lớp (nếu có). Buổi đơn có thể
    // cần GV khác — admin sửa sau qua bulk edit per session.
    const primaryTeacherId = await getPrimaryTeacherId(supabase, tenant.id, parsed.class_id);

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        tenant_id: tenant.id,
        class_id: parsed.class_id,
        course_id: null,
        teacher_id: primaryTeacherId,
        title: parsed.title,
        description: parsed.description ?? "",
        start_time: parsed.start_time,
        duration_minutes: parsed.duration_minutes ?? 90,
        meeting_url: "", // In-person; BYOM nếu có
      })
      .select(
        "id, tenant_id, class_id, teacher_id, title, description, start_time, duration_minutes, is_cancelled",
      )
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/classes");
    const row: ClassSessionRow = {
      ...(data as Omit<ClassSessionRow, "teacher_name">),
      teacher_name: null,
    };
    return { success: true, data: row };
  } catch (e) {
    return err(e);
  }
}

// Tạo nhiều buổi cùng lúc theo lịch tuần — admin chọn:
//   • Khung giờ (HH:MM) + thời lượng
//   • Ngày trong tuần (T2..CN, multi-select)
//   • Khoảng ngày: start_date → end_date
// Engine sinh từng ngày trong range, lọc theo day-of-week. Cap 200
// buổi/lần để tránh tạo nhầm hàng nghìn dòng.
const BulkSessionsSchema = z.object({
  class_id: z.string().uuid(),
  title_template: z.string().trim().min(1).max(150),
  // 0 = CN, 1 = T2, …, 6 = T7
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/), // "19:00" — local time VN
  duration_minutes: z.number().int().min(15).max(720).default(90),
});

export type BulkSessionsInput = z.input<typeof BulkSessionsSchema>;

// Tính các ngày YYYY-MM-DD trong range thoả day-of-week, không phụ
// thuộc TZ server (dùng UTC iteration, day-of-week so với UTC).
function datesInRangeByDow(
  start: string,
  end: string,
  allowedDow: number[],
): string[] {
  const dates: string[] = [];
  const startD = new Date(start + "T00:00:00Z");
  const endD = new Date(end + "T00:00:00Z");
  if (endD < startD) return [];
  const cap = 365; // safety: range max 1 năm
  let count = 0;
  for (
    let d = new Date(startD);
    d <= endD && count <= cap;
    d = new Date(d.getTime() + 86400000), count++
  ) {
    const dow = d.getUTCDay();
    if (!allowedDow.includes(dow)) continue;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// Đếm buổi hiện có của lớp — dùng cho start_seq khi đánh số.
async function countSessionsInClass(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  tenantId: string,
  classId: string,
): Promise<number> {
  const { count } = await supabase
    .from("live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("class_id", classId);
  return count ?? 0;
}

export async function getClassSessionCount(
  classId: string,
): Promise<ActionResult<number>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const c = await countSessionsInClass(supabase, tenant.id, classId);
    return { success: true, data: c };
  } catch (e) {
    return err(e);
  }
}

export async function previewBulkSessions(
  input: BulkSessionsInput,
): Promise<
  ActionResult<{
    count: number;
    start_seq_no: number; // số thứ tự sẽ bắt đầu
    first_dates: string[];
    last_dates: string[];
  }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = BulkSessionsSchema.parse(input);
    const dates = datesInRangeByDow(
      parsed.start_date,
      parsed.end_date,
      parsed.days_of_week,
    );
    const existing = await countSessionsInClass(supabase, tenant.id, parsed.class_id);
    return {
      success: true,
      data: {
        count: dates.length,
        start_seq_no: existing + 1,
        first_dates: dates.slice(0, 3),
        last_dates: dates.slice(-3),
      },
    };
  } catch (e) {
    return err(e);
  }
}

export async function bulkCreateSessions(
  input: BulkSessionsInput,
): Promise<ActionResult<{ created: number }>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = BulkSessionsSchema.parse(input);

    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", parsed.class_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cls) return { success: false, error: "Lớp không tồn tại trong trung tâm." };

    const dates = datesInRangeByDow(parsed.start_date, parsed.end_date, parsed.days_of_week);
    if (dates.length === 0) {
      return {
        success: false,
        error:
          "Không có ngày nào trong khoảng đã chọn khớp với thứ trong tuần.",
      };
    }
    if (dates.length > 200) {
      return {
        success: false,
        error: `Sẽ tạo ${dates.length} buổi — vượt giới hạn 200. Thu hẹp khoảng ngày hoặc tách nhiều đợt.`,
      };
    }

    // Continue đánh số từ buổi đang có. Nếu lớp đã có 5 buổi → bulk
    // 10 buổi mới sẽ được đặt {n} = 6..15. Tránh "Buổi 1 / Buổi 2"
    // bị trùng với buổi manual đã tạo trước đó.
    const existing = await countSessionsInClass(supabase, tenant.id, parsed.class_id);
    const startSeq = existing + 1;
    const duration = parsed.duration_minutes ?? 90;
    // Inherit teacher_id từ PRIMARY của lớp cho tất cả buổi mới.
    const primaryTeacherId = await getPrimaryTeacherId(supabase, tenant.id, parsed.class_id);
    const rows = dates.map((dateStr, i) => {
      const seqNo = startSeq + i;
      // Title template hỗ trợ {n} = số thứ tự, {date} = DD/MM/YYYY VN.
      const [yy, mm, dd] = dateStr.split("-");
      const vnDate = `${dd}/${mm}/${yy}`;
      const title = parsed.title_template
        .replaceAll("{n}", String(seqNo))
        .replaceAll("{date}", vnDate);

      // Build ISO start_time với offset VN (+07:00) — không phụ thuộc
      // TZ server. Postgres lưu UTC nên ISO chuẩn là đủ.
      const startIso = `${dateStr}T${parsed.time}:00+07:00`;

      return {
        tenant_id: tenant.id,
        class_id: parsed.class_id,
        course_id: null,
        teacher_id: primaryTeacherId,
        title,
        description: "",
        start_time: startIso,
        duration_minutes: duration,
        meeting_url: "",
      };
    });

    const { error } = await supabase.from("live_sessions").insert(rows);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/classes");
    revalidatePath(`/dashboard/classes/${parsed.class_id}`);
    return { success: true, data: { created: rows.length } };
  } catch (e) {
    return err(e);
  }
}

// Xoá hàng loạt buổi học theo danh sách ID. Trả về số đã xoá / lỗi.
// Caller cần confirm UX trước khi gọi.
export async function bulkDeleteSessions(input: {
  session_ids: string[];
}): Promise<ActionResult<{ deleted: number }>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.session_ids.length === 0) {
      return { success: false, error: "Chưa chọn buổi nào." };
    }
    const { error, count } = await supabase
      .from("live_sessions")
      .delete({ count: "exact" })
      .eq("tenant_id", tenant.id)
      .in("id", input.session_ids);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/classes");
    return { success: true, data: { deleted: count ?? input.session_ids.length } };
  } catch (e) {
    return err(e);
  }
}

// Cập nhật hàng loạt — chỉ các trường thực sự thay đổi (undefined =
// giữ nguyên). Đổi GIỜ chỉ thay HH:MM, ngày của từng buổi giữ nguyên.
// SHIFT_DAYS dịch chuyển toàn bộ start_time +/- N ngày.
const BulkEditSchema = z
  .object({
    session_ids: z.array(z.string().uuid()).min(1),
    new_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    new_duration_minutes: z.number().int().min(15).max(720).optional(),
    shift_days: z.number().int().min(-365).max(365).optional(),
    cancel: z.boolean().optional(), // true = mark cancelled, false = uncancel
  })
  .refine(
    (d) =>
      d.new_time !== undefined ||
      d.new_duration_minutes !== undefined ||
      d.shift_days !== undefined ||
      d.cancel !== undefined,
    { message: "Phải chọn ít nhất 1 thay đổi." },
  );

export type BulkEditInput = z.input<typeof BulkEditSchema>;

export async function bulkEditSessions(
  input: BulkEditInput,
): Promise<ActionResult<{ updated: number; errors: number }>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = BulkEditSchema.parse(input);

    // Lấy buổi hiện tại để compute start_time mới per-session khi cần.
    const { data: rows, error: loadErr } = await supabase
      .from("live_sessions")
      .select("id, start_time")
      .eq("tenant_id", tenant.id)
      .in("id", parsed.session_ids);
    if (loadErr) return { success: false, error: loadErr.message };

    let updated = 0;
    let errors = 0;

    for (const row of (rows ?? []) as Array<{ id: string; start_time: string }>) {
      const patch: Record<string, unknown> = {};

      if (parsed.new_time !== undefined || parsed.shift_days !== undefined) {
        // Tách date + time hiện tại theo VN offset, dựng lại ISO.
        const d = new Date(row.start_time);
        // Đổi sang VN local để lấy date components đúng.
        const vn = new Date(d.getTime() + 7 * 3600 * 1000); // +07:00
        let year = vn.getUTCFullYear();
        let month = vn.getUTCMonth();
        let day = vn.getUTCDate();
        if (parsed.shift_days) {
          const shifted = new Date(Date.UTC(year, month, day));
          shifted.setUTCDate(shifted.getUTCDate() + parsed.shift_days);
          year = shifted.getUTCFullYear();
          month = shifted.getUTCMonth();
          day = shifted.getUTCDate();
        }
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const timeStr =
          parsed.new_time ??
          `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
        patch.start_time = `${dateStr}T${timeStr}:00+07:00`;
      }
      if (parsed.new_duration_minutes !== undefined) {
        patch.duration_minutes = parsed.new_duration_minutes;
      }
      if (parsed.cancel !== undefined) {
        patch.is_cancelled = parsed.cancel;
        // Theo CHECK constraint từ 0036: is_cancelled=true cần cancellation_reason.
        if (parsed.cancel) patch.cancellation_reason = "BY_TEACHER";
        else patch.cancellation_reason = null;
      }

      const { error: updErr } = await supabase
        .from("live_sessions")
        .update(patch)
        .eq("id", row.id)
        .eq("tenant_id", tenant.id);
      if (updErr) errors++;
      else updated++;
    }

    revalidatePath("/dashboard/classes");
    return { success: true, data: { updated, errors } };
  } catch (e) {
    return err(e);
  }
}

export async function deleteClassSession(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("live_sessions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
