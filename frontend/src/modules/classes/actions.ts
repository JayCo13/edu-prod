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

export async function previewBulkSessions(
  input: BulkSessionsInput,
): Promise<ActionResult<{ count: number; first_dates: string[]; last_dates: string[] }>> {
  try {
    await requireAdmin();
    const parsed = BulkSessionsSchema.parse(input);
    const dates = datesInRangeByDow(parsed.start_date, parsed.end_date, parsed.days_of_week);
    return {
      success: true,
      data: {
        count: dates.length,
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

    const duration = parsed.duration_minutes ?? 90;
    const rows = dates.map((dateStr, i) => {
      const seqNo = i + 1;
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
