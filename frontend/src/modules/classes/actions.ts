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
  title: string;
  description: string | null;
  start_time: string;
  duration_minutes: number;
  is_cancelled: boolean;
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
      .select("id, tenant_id, class_id, title, description, start_time, duration_minutes, is_cancelled")
      .eq("tenant_id", tenant.id)
      .eq("class_id", input.class_id)
      .order("start_time", { ascending: false })
      .limit(200);
    if (input.from) q = q.gte("start_time", input.from);
    if (input.to) q = q.lt("start_time", input.to);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ClassSessionRow[] };
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

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        tenant_id: tenant.id,
        class_id: parsed.class_id,
        course_id: null,
        title: parsed.title,
        description: parsed.description ?? "",
        start_time: parsed.start_time,
        duration_minutes: parsed.duration_minutes ?? 90,
        meeting_url: "", // In-person; BYOM nếu có
      })
      .select("id, tenant_id, class_id, title, description, start_time, duration_minutes, is_cancelled")
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/classes");
    return { success: true, data: data as ClassSessionRow };
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
