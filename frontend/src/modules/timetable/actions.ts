"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ActionResult } from "@/types/database";
import type {
  ClassRow,
  PeriodRow,
  PeriodShift,
  SubjectRow,
  SubjectTeacherRow,
} from "./types";

/**
 * Timetable CRUD — classes / subjects / periods.
 *
 * Slot placement (timetable_slots) lives in a separate file next cycle
 * because it carries conflict logic + the grid editor's edit surface.
 */

const PATH = "/dashboard/timetable";

function err<T = null>(e: unknown): ActionResult<T> {
  const message = e instanceof Error ? e.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

async function requireAdmin() {
  const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
  if (!isAdmin) {
    return {
      ok: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể chỉnh sửa.",
    };
  }
  return { ok: true as const, supabase, tenant };
}

// ─── Classes ────────────────────────────────────────────────────────────

const classCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên lớp không được trống").max(40),
  grade_level: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .nullable(),
  year_label: z.string().max(20).optional().default(""),
  homeroom_teacher_id: z.string().uuid().optional().nullable(),
});

const classUpdateSchema = classCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export async function listClasses(): Promise<ActionResult<ClassRow[]>> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("grade_level", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as ClassRow[] };
  } catch (e) {
    return err(e);
  }
}

// ── Public TKB sharing (migration 0033) ─────────────────────────────────
//
// Returns the tenant's public_tkb_token so the editor can build the QR
// URL. Token is read-only here; rotation is a separate (admin) action.

export async function getPublicTkbToken(): Promise<
  ActionResult<{ token: string }>
> {
  try {
    const { tenant } = await getCurrentTenantContext();
    const token = (tenant as { public_tkb_token?: string }).public_tkb_token;
    if (!token) {
      return {
        success: false,
        error:
          "Token chia sẻ chưa được tạo. Vui lòng apply migration 0033.",
      };
    }
    return { success: true, data: { token } };
  } catch (e) {
    return err(e);
  }
}

// ── Bulk-seed classes for a grade ────────────────────────────────────────
//
// Vietnamese schools name homeroom classes in several common conventions:
//   • LETTER_NUM — 6A1, 6A2, ... 6A12  (most THCS/THPT large schools)
//   • LETTER     — 6A, 6B, ... 6L       (smaller schools, older style)
//   • DOT        — 6.1, 6.2, ... 6.12   (modern MOET reform-era schools)
//   • SLASH      — 6/1, 6/2, ... 6/12   (some southern schools)
//
// This action lets the admin create an entire grade's worth of classes in
// one click. Idempotent: any (tenant, name, year_label) already present is
// skipped and reported back.
type ClassNameFormat = "LETTER_NUM" | "LETTER" | "DOT" | "SLASH";

function buildClassName(
  grade: number,
  index: number,
  format: ClassNameFormat,
  letter = "A",
): string {
  switch (format) {
    case "LETTER_NUM":
      return `${grade}${letter}${index}`;
    case "LETTER":
      // index → A, B, C... up to Z. Caller is responsible for capping count.
      return `${grade}${String.fromCharCode(64 + index)}`;
    case "DOT":
      return `${grade}.${index}`;
    case "SLASH":
      return `${grade}/${index}`;
  }
}

const seedClassesSchema = z.object({
  grade_level: z.number().int().min(1).max(12),
  count: z.number().int().min(1).max(30),
  format: z.enum(["LETTER_NUM", "LETTER", "DOT", "SLASH"]),
  letter: z
    .string()
    .regex(/^[A-Z]$/u, "Chỉ chấp nhận 1 chữ cái A-Z")
    .default("A"),
  year_label: z.string().max(20).default(""),
});

export interface SeedClassesResult {
  created: ClassRow[];
  skipped: string[];
}

export async function seedGradeClasses(
  input: z.infer<typeof seedClassesSchema>,
): Promise<ActionResult<SeedClassesResult>> {
  try {
    const parsed = seedClassesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const { grade_level, count, format, letter } = parsed.data;
    // Fall back to the current academic year (e.g. "2026-2027") so bulk
    // creates never leave the column blank by accident. Manual single-add
    // still allows empty if the admin really wants it.
    const yr = parsed.data.year_label.trim();
    const now = new Date();
    const year_label =
      yr ||
      // School year flips in July (Vietnam). Aug-Dec → curYear-(curYear+1),
      // Jan-Jul → (curYear-1)-curYear so admins setting up mid-year don't
      // get the wrong academic year.
      (now.getMonth() >= 6
        ? `${now.getFullYear()}-${now.getFullYear() + 1}`
        : `${now.getFullYear() - 1}-${now.getFullYear()}`);

    // LETTER tops out at 26 (A..Z); cap defensively even though the schema
    // already limits count to 30.
    const effectiveCount = format === "LETTER" ? Math.min(count, 26) : count;

    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const names = Array.from({ length: effectiveCount }, (_, i) =>
      buildClassName(grade_level, i + 1, format, letter),
    );

    // Pre-fetch existing names in the same (grade, year) to report skips
    // without hitting UNIQUE-violation errors on insert.
    const { data: existingRows, error: readErr } = await auth.supabase
      .from("classes")
      .select("name")
      .eq("tenant_id", auth.tenant.id)
      .eq("year_label", year_label)
      .in("name", names);
    if (readErr) return { success: false, error: readErr.message };

    const existing = new Set((existingRows ?? []).map((r) => r.name));
    const toInsert = names.filter((n) => !existing.has(n));
    const skipped = names.filter((n) => existing.has(n));

    if (toInsert.length === 0) {
      revalidatePath(`${PATH}/classes`);
      return { success: true, data: { created: [], skipped } };
    }

    const payload = toInsert.map((name) => ({
      tenant_id: auth.tenant.id,
      name,
      grade_level,
      year_label,
      homeroom_teacher_id: null,
    }));

    const { data, error } = await auth.supabase
      .from("classes")
      .insert(payload)
      .select();
    if (error) return { success: false, error: error.message };

    revalidatePath(`${PATH}/classes`);
    return {
      success: true,
      data: { created: (data ?? []) as ClassRow[], skipped },
    };
  } catch (e) {
    return err<SeedClassesResult>(e);
  }
}

export async function createClass(
  input: z.infer<typeof classCreateSchema>,
): Promise<ActionResult<ClassRow>> {
  try {
    const parsed = classCreateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { data, error } = await auth.supabase
      .from("classes")
      .insert({
        tenant_id: auth.tenant.id,
        name: parsed.data.name,
        grade_level: parsed.data.grade_level ?? null,
        year_label: parsed.data.year_label ?? "",
        homeroom_teacher_id: parsed.data.homeroom_teacher_id ?? null,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/classes`);
    return { success: true, data: data as ClassRow };
  } catch (e) {
    return err<ClassRow>(e);
  }
}

export async function updateClass(
  id: string,
  input: z.infer<typeof classUpdateSchema>,
): Promise<ActionResult<ClassRow>> {
  try {
    const parsed = classUpdateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { data, error } = await auth.supabase
      .from("classes")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/classes`);
    return { success: true, data: data as ClassRow };
  } catch (e) {
    return err<ClassRow>(e);
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { error } = await auth.supabase
      .from("classes")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/classes`);
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ─── Subjects ───────────────────────────────────────────────────────────

const HEX = /^#[0-9A-Fa-f]{6}$/;

const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên môn không được trống").max(80),
  short_code: z
    .string()
    .trim()
    .min(1, "Mã môn không được trống")
    .max(8)
    .regex(/^\S+$/, "Mã môn không chứa khoảng trắng"),
  color: z.string().regex(HEX, "Mã màu không hợp lệ (ví dụ: #4F46E5)").default("#6366F1"),
});

const subjectUpdateSchema = subjectCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export async function listSubjects(): Promise<ActionResult<SubjectRow[]>> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("name", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SubjectRow[] };
  } catch (e) {
    return err(e);
  }
}

// Canonical Vietnamese MOET subject list — covers Tiểu học → THPT. Used by
// `seedStandardSubjects` to populate a brand-new tenant with one click.
// Short codes follow common Vietnamese convention (T = Toán, V = Văn, A =
// Anh, etc.); colors give each row a distinct visual identity on the grid.
const STANDARD_VN_SUBJECTS: readonly {
  name: string;
  short_code: string;
  color: string;
}[] = [
  { name: "Toán", short_code: "T", color: "#4F46E5" },
  { name: "Ngữ văn", short_code: "V", color: "#E11D48" },
  { name: "Tiếng Anh", short_code: "A", color: "#0EA5E9" },
  { name: "Vật lý", short_code: "L", color: "#14B8A6" },
  { name: "Hoá học", short_code: "H", color: "#F59E0B" },
  { name: "Sinh học", short_code: "S", color: "#10B981" },
  { name: "Lịch sử", short_code: "SU", color: "#A855F7" },
  { name: "Địa lý", short_code: "DL", color: "#F97316" },
  { name: "Giáo dục công dân", short_code: "GD", color: "#64748B" },
  { name: "Tin học", short_code: "TH", color: "#06B6D4" },
  { name: "Công nghệ", short_code: "CN", color: "#84CC16" },
  { name: "Thể dục", short_code: "TD", color: "#EF4444" },
  { name: "Âm nhạc", short_code: "AN", color: "#EC4899" },
  { name: "Mỹ thuật", short_code: "MT", color: "#8B5CF6" },
  { name: "Quốc phòng - An ninh", short_code: "QP", color: "#475569" },
];

export interface SeedSubjectsResult {
  created: SubjectRow[];
  skipped: string[]; // names that already existed (name OR short_code clash)
}

/** Bulk-insert the standard Vietnamese MOET subject list. Idempotent: any
 *  subject whose name OR short_code already exists in this tenant is skipped
 *  and reported back so the UI can tell the user. */
export async function seedStandardSubjects(): Promise<
  ActionResult<SeedSubjectsResult>
> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    // Pull existing subjects once so we can pre-filter and avoid one round-
    // trip per insert. UNIQUE constraints on (tenant_id, name) and
    // (tenant_id, short_code) are the authoritative guard.
    const { data: existingRows, error: readErr } = await auth.supabase
      .from("subjects")
      .select("name, short_code")
      .eq("tenant_id", auth.tenant.id);
    if (readErr) return { success: false, error: readErr.message };

    const existingNames = new Set(
      (existingRows ?? []).map((r) => r.name.toLowerCase()),
    );
    const existingCodes = new Set(
      (existingRows ?? []).map((r) => r.short_code.toUpperCase()),
    );

    const toInsert: { name: string; short_code: string; color: string }[] = [];
    const skipped: string[] = [];
    for (const s of STANDARD_VN_SUBJECTS) {
      if (
        existingNames.has(s.name.toLowerCase()) ||
        existingCodes.has(s.short_code.toUpperCase())
      ) {
        skipped.push(s.name);
        continue;
      }
      toInsert.push(s);
    }

    if (toInsert.length === 0) {
      revalidatePath(`${PATH}/subjects`);
      return { success: true, data: { created: [], skipped } };
    }

    const payload = toInsert.map((s) => ({
      tenant_id: auth.tenant.id,
      name: s.name,
      short_code: s.short_code.toUpperCase(),
      color: s.color.toUpperCase(),
    }));

    const { data, error } = await auth.supabase
      .from("subjects")
      .insert(payload)
      .select();
    if (error) return { success: false, error: error.message };

    revalidatePath(`${PATH}/subjects`);
    return {
      success: true,
      data: { created: (data ?? []) as SubjectRow[], skipped },
    };
  } catch (e) {
    return err<SeedSubjectsResult>(e);
  }
}

export async function createSubject(
  input: z.infer<typeof subjectCreateSchema>,
): Promise<ActionResult<SubjectRow>> {
  try {
    const parsed = subjectCreateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { data, error } = await auth.supabase
      .from("subjects")
      .insert({
        tenant_id: auth.tenant.id,
        name: parsed.data.name,
        short_code: parsed.data.short_code.toUpperCase(),
        color: parsed.data.color.toUpperCase(),
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/subjects`);
    return { success: true, data: data as SubjectRow };
  } catch (e) {
    return err<SubjectRow>(e);
  }
}

export async function updateSubject(
  id: string,
  input: z.infer<typeof subjectUpdateSchema>,
): Promise<ActionResult<SubjectRow>> {
  try {
    const parsed = subjectUpdateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const patch = { ...parsed.data };
    if (patch.short_code) patch.short_code = patch.short_code.toUpperCase();
    if (patch.color) patch.color = patch.color.toUpperCase();
    const { data, error } = await auth.supabase
      .from("subjects")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/subjects`);
    return { success: true, data: data as SubjectRow };
  } catch (e) {
    return err<SubjectRow>(e);
  }
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { error } = await auth.supabase
      .from("subjects")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/subjects`);
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ─── Periods (khung tiết) ───────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const periodCreateSchema = z.object({
  shift: z.enum(["SANG", "CHIEU"] as const),
  period_number: z.number().int().min(1).max(20),
  start_time: z.string().regex(TIME_RE, "Giờ bắt đầu sai định dạng HH:MM"),
  end_time: z.string().regex(TIME_RE, "Giờ kết thúc sai định dạng HH:MM"),
});

const periodUpdateSchema = periodCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export async function listPeriods(): Promise<ActionResult<PeriodRow[]>> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("periods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("shift", { ascending: true })
      .order("period_number", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as PeriodRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createPeriod(
  input: z.infer<typeof periodCreateSchema>,
): Promise<ActionResult<PeriodRow>> {
  try {
    const parsed = periodCreateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    if (parsed.data.start_time >= parsed.data.end_time) {
      return { success: false, error: "Giờ kết thúc phải sau giờ bắt đầu." };
    }
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { data, error } = await auth.supabase
      .from("periods")
      .insert({
        tenant_id: auth.tenant.id,
        shift: parsed.data.shift,
        period_number: parsed.data.period_number,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/periods`);
    return { success: true, data: data as PeriodRow };
  } catch (e) {
    return err<PeriodRow>(e);
  }
}

export async function updatePeriod(
  id: string,
  input: z.infer<typeof periodUpdateSchema>,
): Promise<ActionResult<PeriodRow>> {
  try {
    const parsed = periodUpdateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    if (
      parsed.data.start_time &&
      parsed.data.end_time &&
      parsed.data.start_time >= parsed.data.end_time
    ) {
      return { success: false, error: "Giờ kết thúc phải sau giờ bắt đầu." };
    }
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { data, error } = await auth.supabase
      .from("periods")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/periods`);
    return { success: true, data: data as PeriodRow };
  } catch (e) {
    return err<PeriodRow>(e);
  }
}

export async function deletePeriod(id: string): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { error } = await auth.supabase
      .from("periods")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      // FK from timetable_slots blocks deletion of in-use periods — surface
      // a Vietnamese-friendly hint.
      if (error.code === "23503") {
        return {
          success: false,
          error:
            "Không thể xoá: tiết này đang được dùng trong thời khoá biểu. Hãy gỡ ra trước.",
        };
      }
      return { success: false, error: error.message };
    }
    revalidatePath(`${PATH}/periods`);
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

/** Convenience: seed a standard Vietnamese-school period grid (T1-T5 SÁNG,
 *  T1-T5 CHIỀU). Idempotent — skips if any period already exists. */
export async function seedDefaultPeriods(): Promise<
  ActionResult<{ inserted: number }>
> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };
    const { count } = await auth.supabase
      .from("periods")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", auth.tenant.id);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: "Trung tâm đã có khung tiết. Hãy xoá trước nếu muốn seed lại.",
      };
    }
    const rows: {
      tenant_id: string;
      shift: PeriodShift;
      period_number: number;
      start_time: string;
      end_time: string;
    }[] = [
      // Sáng: 5 tiết 45 phút
      ["SANG", 1, "07:00", "07:45"],
      ["SANG", 2, "07:50", "08:35"],
      ["SANG", 3, "08:55", "09:40"],
      ["SANG", 4, "09:45", "10:30"],
      ["SANG", 5, "10:35", "11:20"],
      // Chiều
      ["CHIEU", 1, "13:30", "14:15"],
      ["CHIEU", 2, "14:20", "15:05"],
      ["CHIEU", 3, "15:25", "16:10"],
      ["CHIEU", 4, "16:15", "17:00"],
      ["CHIEU", 5, "17:05", "17:50"],
    ].map(([shift, n, start, end]) => ({
      tenant_id: auth.tenant.id,
      shift: shift as PeriodShift,
      period_number: n as number,
      start_time: start as string,
      end_time: end as string,
    }));
    const { error, data } = await auth.supabase
      .from("periods")
      .insert(rows)
      .select("id");
    if (error) return { success: false, error: error.message };
    revalidatePath(`${PATH}/periods`);
    return { success: true, data: { inserted: data?.length ?? 0 } };
  } catch (e) {
    return err<{ inserted: number }>(e);
  }
}

// ─── Subject ↔ Teachers ────────────────────────────────────────────────

/** Returns every subject_teachers pair for the tenant — the editor reads
 *  this once and indexes by subject_id locally. */
export async function listSubjectTeachers(): Promise<
  ActionResult<SubjectTeacherRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("subject_teachers")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SubjectTeacherRow[] };
  } catch (e) {
    return err(e);
  }
}

/** Replace the set of qualified teachers for a subject. Diff against
 *  current rows so we only insert/delete what actually changed —
 *  preserves created_at on rows that already exist. */
export async function setSubjectTeachers(
  subjectId: string,
  teacherIds: string[],
): Promise<ActionResult<{ added: number; removed: number }>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    // Read current state
    const { data: current, error: readErr } = await auth.supabase
      .from("subject_teachers")
      .select("teacher_id")
      .eq("tenant_id", auth.tenant.id)
      .eq("subject_id", subjectId);
    if (readErr) return { success: false, error: readErr.message };

    const currentSet = new Set((current ?? []).map((r) => r.teacher_id as string));
    const targetSet = new Set(teacherIds);

    const toAdd = [...targetSet].filter((id) => !currentSet.has(id));
    const toRemove = [...currentSet].filter((id) => !targetSet.has(id));

    if (toAdd.length > 0) {
      const { error } = await auth.supabase.from("subject_teachers").insert(
        toAdd.map((teacher_id) => ({
          tenant_id: auth.tenant.id,
          subject_id: subjectId,
          teacher_id,
        })),
      );
      if (error) return { success: false, error: error.message };
    }

    if (toRemove.length > 0) {
      const { error } = await auth.supabase
        .from("subject_teachers")
        .delete()
        .eq("tenant_id", auth.tenant.id)
        .eq("subject_id", subjectId)
        .in("teacher_id", toRemove);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath(`${PATH}/subjects`);
    revalidatePath(`${PATH}/editor`);
    return {
      success: true,
      data: { added: toAdd.length, removed: toRemove.length },
    };
  } catch (e) {
    return err<{ added: number; removed: number }>(e);
  }
}
