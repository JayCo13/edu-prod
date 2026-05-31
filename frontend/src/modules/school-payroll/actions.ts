"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import { getEffectiveQuota } from "./quota";
import { computePeriodRateSegments } from "./salary-rate";
import type {
  EffectiveQuota,
  PeriodRateForYear,
  QuotaReductionEntry,
  SchoolYearPeriodRow,
  SubstitutionReason,
  SubstitutionRow,
  TeacherOvertimeAdvanceRow,
  TeacherPeriodQuotaRow,
  TeacherSalaryBasisRow,
} from "./types";

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

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

// ══ TENANT DEFAULT ═════════════════════════════════════════════════════

export async function setTenantDefaultPeriodsPerWeek(
  value: number,
): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (value < 1 || value > 50) {
      return { success: false, error: "Giá trị 1-50." };
    }
    const { error } = await supabase
      .from("tenants")
      .update({ default_periods_per_week: value })
      .eq("id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ══ SCHOOL YEAR PERIODS ════════════════════════════════════════════════

const schoolYearSchema = z
  .object({
    year_label: z.string().regex(/^\d{4}-\d{4}$/, "Định dạng YYYY-YYYY."),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    teaching_weeks: z.number().int().min(1).max(52),
  })
  .refine((d) => d.end_date > d.start_date, {
    message: "end_date phải sau start_date.",
    path: ["end_date"],
  });

export type SchoolYearInput = z.infer<typeof schoolYearSchema>;

export async function listSchoolYears(): Promise<
  ActionResult<SchoolYearPeriodRow[]>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("school_year_periods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("start_date", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SchoolYearPeriodRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createSchoolYear(
  input: SchoolYearInput,
): Promise<ActionResult<SchoolYearPeriodRow>> {
  try {
    const parsed = schoolYearSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("school_year_periods")
      .insert({
        tenant_id: tenant.id,
        year_label: parsed.data.year_label,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        teaching_weeks: parsed.data.teaching_weeks,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true, data: data as SchoolYearPeriodRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateSchoolYear(
  id: string,
  input: SchoolYearInput,
): Promise<ActionResult<SchoolYearPeriodRow>> {
  try {
    const parsed = schoolYearSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("school_year_periods")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true, data: data as SchoolYearPeriodRow };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSchoolYear(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("school_year_periods")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ══ QUOTAS ═════════════════════════════════════════════════════════════

const reductionSchema = z.object({
  type: z.enum([
    "GVCN",
    "TO_TRUONG",
    "TO_PHO",
    "TO_TRUONG_HS",
    "TO_PHO_HS",
    "KHAC",
  ]),
  minus: z.number().int().min(0).max(20),
  allowance_received: z.boolean(),
  note: z.string().optional(),
});

const quotaSchema = z.object({
  teacher_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  base_periods_per_week: z.number().int().min(1).max(50).nullable(),
  reductions: z.array(reductionSchema).max(10),
});

export type QuotaInput = z.infer<typeof quotaSchema>;

export async function listQuotas(
  schoolYearId: string,
): Promise<ActionResult<TeacherPeriodQuotaRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_period_quotas")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("school_year_id", schoolYearId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TeacherPeriodQuotaRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function upsertQuota(
  input: QuotaInput,
): Promise<ActionResult<TeacherPeriodQuotaRow>> {
  try {
    const parsed = quotaSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_period_quotas")
      .upsert(
        {
          tenant_id: tenant.id,
          teacher_id: parsed.data.teacher_id,
          school_year_id: parsed.data.school_year_id,
          base_periods_per_week: parsed.data.base_periods_per_week,
          reductions: parsed.data.reductions,
        },
        { onConflict: "tenant_id,teacher_id,school_year_id" },
      )
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true, data: data as TeacherPeriodQuotaRow };
  } catch (e) {
    return err(e);
  }
}

export async function getEffectiveQuotaForTeacher(
  teacherId: string,
  schoolYearId: string,
): Promise<ActionResult<EffectiveQuota>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const quota = await getEffectiveQuota(supabase, {
      tenantId: tenant.id,
      teacherId,
      schoolYearId,
    });
    return { success: true, data: quota };
  } catch (e) {
    return err(e);
  }
}

// ══ SALARY BASIS (time-series) ═════════════════════════════════════════

const salaryBasisSchema = z
  .object({
    teacher_id: z.string().uuid(),
    school_year_id: z.string().uuid(),
    // Mode A
    salary_coefficient: z.number().min(0).nullable(),
    base_salary_vnd: z.number().int().min(0).nullable(),
    position_allowance_vnd: z.number().int().min(0).default(0),
    other_allowances_vnd: z.number().int().min(0).default(0),
    bao_luu_coefficient: z.number().min(0).default(0),
    // Mode B
    flat_rate_per_period_vnd: z.number().int().min(0).nullable(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .refine(
    (d) =>
      (d.flat_rate_per_period_vnd !== null &&
        d.salary_coefficient === null &&
        d.base_salary_vnd === null) ||
      (d.flat_rate_per_period_vnd === null &&
        d.salary_coefficient !== null &&
        d.base_salary_vnd !== null),
    {
      message:
        "Phải chọn 1 trong 2 chế độ: 'Compute từ hệ số' (trường công) hoặc 'Flat per period' (trường tư).",
    },
  );

export type SalaryBasisInput = z.infer<typeof salaryBasisSchema>;

export async function listSalaryBasis(
  teacherId: string,
  schoolYearId: string,
): Promise<ActionResult<TeacherSalaryBasisRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_salary_basis")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", teacherId)
      .eq("school_year_id", schoolYearId)
      .order("effective_from", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TeacherSalaryBasisRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createSalaryBasis(
  input: SalaryBasisInput,
): Promise<ActionResult<TeacherSalaryBasisRow>> {
  try {
    const parsed = salaryBasisSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_salary_basis")
      .insert({
        tenant_id: tenant.id,
        ...parsed.data,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true, data: data as TeacherSalaryBasisRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateSalaryBasis(
  id: string,
  input: SalaryBasisInput,
): Promise<ActionResult<TeacherSalaryBasisRow>> {
  try {
    const parsed = salaryBasisSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_salary_basis")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true, data: data as TeacherSalaryBasisRow };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSalaryBasis(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("teacher_salary_basis")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/school-payroll");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

export async function getPeriodRateForTeacher(
  teacherId: string,
  schoolYearId: string,
): Promise<ActionResult<PeriodRateForYear>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const rate = await computePeriodRateSegments(supabase, {
      tenantId: tenant.id,
      teacherId,
      schoolYearId,
    });
    return { success: true, data: rate };
  } catch (e) {
    return err(e);
  }
}

// ══ SUBSTITUTIONS ══════════════════════════════════════════════════════

const substitutionSchema = z.object({
  school_year_id: z.string().uuid(),
  timetable_slot_id: z.string().uuid().nullable(),
  session_id: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_index: z.number().int().min(1).max(20),
  shift: z.string().nullable().optional(),
  original_teacher_id: z.string().uuid(),
  substitute_teacher_id: z.string().uuid(),
  reason: z.enum(["ÔM", "PHÉP", "KHÔNG_PHÉP", "CÔNG_TÁC", "BỒI_DƯỠNG", "KHÁC"]),
  reason_note: z.string().max(500).nullable().optional(),
  pay_substitute: z.boolean().default(true),
  deduct_original_flag: z.boolean().default(false),
  deduct_original_note: z.string().max(500).nullable().optional(),
});

export type SubstitutionInput = z.infer<typeof substitutionSchema>;

export async function createSubstitution(
  input: SubstitutionInput,
): Promise<ActionResult<SubstitutionRow>> {
  try {
    const parsed = substitutionSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    if (parsed.data.original_teacher_id === parsed.data.substitute_teacher_id) {
      return { success: false, error: "GV gốc và GV thay phải khác nhau." };
    }
    if (!parsed.data.timetable_slot_id && !parsed.data.session_id) {
      return { success: false, error: "Cần ít nhất slot hoặc session." };
    }
    const { supabase, tenant, userId } = await requireAdmin();
    const { data, error } = await supabase
      .from("substitutions")
      .insert({
        tenant_id: tenant.id,
        ...parsed.data,
        created_by: userId,
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/timetable/substitutes");
    return { success: true, data: data as SubstitutionRow };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSubstitution(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("substitutions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/timetable/substitutes");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

export async function listSubstitutionsForDate(
  date: string,
): Promise<ActionResult<SubstitutionRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("substitutions")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("date", date)
      .order("period_index", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SubstitutionRow[] };
  } catch (e) {
    return err(e);
  }
}

// ── Substitute suggestion với scoring ──────────────────────────────────
//
// Cho 1 slot (date, day_of_week, period_id, subject_id, class_id):
//   1. Lấy slot của GV gốc → biết subject, class, grade
//   2. Quét tất cả tenant_teachers:
//      • Kiểm tra trống tiết đó: KHÔNG có timetable_slot khác ở
//        (day_of_week, period_id) → trống.
//      • Score = 0
//        + 5 nếu cùng môn (subject match)
//        + 3 nếu cùng khối (grade match qua classes)
//        + 5 nếu là GVCN của lớp đó
//        − 2 mỗi lần đã thay trong 30 ngày (anti-overload, max -10)
//   3. Tách 2 nhóm: trống tiết (sort score desc) + đang bận (cảnh báo)
//
// Output gồm cả 2 nhóm để UI render rõ — admin tự quyết.

export interface SubstituteCandidate {
  teacher_id: string;
  display_name: string;
  is_free: boolean; // false = đang bận tiết đó
  same_subject: boolean;
  same_grade: boolean;
  is_homeroom: boolean;
  recent_substitutions: number; // số lần thay trong 30 ngày qua
  score: number;
  busy_with: { class_name: string; subject_short: string } | null;
}

export async function suggestSubstitutes(params: {
  date: string;
  timetable_slot_id: string;
}): Promise<ActionResult<SubstituteCandidate[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();

    // 1. Lấy slot chi tiết
    const { data: slot, error: slotErr } = await supabase
      .from("timetable_slots")
      .select(
        "id, day_of_week, period_id, subject_id, class_id, teacher_id, classes:class_id(name, grade_level, homeroom_teacher_id)",
      )
      .eq("id", params.timetable_slot_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (slotErr || !slot) {
      return { success: false, error: "Không tìm thấy tiết trong TKB." };
    }

    const slotClass = Array.isArray(slot.classes) ? slot.classes[0] : slot.classes;

    // 2. Lấy tất cả GV
    const { data: teachers } = await supabase
      .from("tenant_teachers")
      .select("id, display_name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    if (!teachers || teachers.length === 0) {
      return { success: true, data: [] };
    }

    // 3. Lấy busy map cho (day_of_week, period_id)
    const { data: busy } = await supabase
      .from("timetable_slots")
      .select(
        "teacher_id, classes:class_id(name), subjects:subject_id(short_code)",
      )
      .eq("tenant_id", tenant.id)
      .eq("day_of_week", slot.day_of_week)
      .eq("period_id", slot.period_id)
      .not("teacher_id", "is", null);

    const busyMap = new Map<
      string,
      { class_name: string; subject_short: string }
    >();
    for (const b of (busy ?? []) as Array<{
      teacher_id: string;
      classes: { name: string } | { name: string }[];
      subjects: { short_code: string } | { short_code: string }[];
    }>) {
      const cls = Array.isArray(b.classes) ? b.classes[0] : b.classes;
      const sub = Array.isArray(b.subjects) ? b.subjects[0] : b.subjects;
      busyMap.set(b.teacher_id, {
        class_name: cls?.name ?? "?",
        subject_short: sub?.short_code ?? "?",
      });
    }

    // 4. Lấy môn GV đang dạy (để check same_subject)
    const { data: teacherSubjects } = await supabase
      .from("timetable_slots")
      .select("teacher_id, subject_id")
      .eq("tenant_id", tenant.id)
      .not("teacher_id", "is", null);

    const teacherSubjectSet = new Map<string, Set<string>>();
    for (const ts of (teacherSubjects ?? []) as {
      teacher_id: string;
      subject_id: string;
    }[]) {
      const s = teacherSubjectSet.get(ts.teacher_id) ?? new Set<string>();
      s.add(ts.subject_id);
      teacherSubjectSet.set(ts.teacher_id, s);
    }

    // 5. Lấy số lần dạy thay trong 30 ngày qua
    const thirtyDaysAgo = new Date(params.date);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentSubs } = await supabase
      .from("substitutions")
      .select("substitute_teacher_id")
      .eq("tenant_id", tenant.id)
      .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
      .lte("date", params.date);

    const recentMap = new Map<string, number>();
    for (const r of (recentSubs ?? []) as { substitute_teacher_id: string }[]) {
      recentMap.set(
        r.substitute_teacher_id,
        (recentMap.get(r.substitute_teacher_id) ?? 0) + 1,
      );
    }

    // 6. Lấy thông tin lớp (môn, khối) của các GV (cho same_grade match)
    const slotGrade = slotClass?.grade_level ?? null;
    const { data: gradeSlots } = await supabase
      .from("timetable_slots")
      .select("teacher_id, classes:class_id(grade_level)")
      .eq("tenant_id", tenant.id)
      .not("teacher_id", "is", null);

    const teacherGrades = new Map<string, Set<number>>();
    for (const gs of (gradeSlots ?? []) as Array<{
      teacher_id: string;
      classes: { grade_level: number | null } | { grade_level: number | null }[];
    }>) {
      const cls = Array.isArray(gs.classes) ? gs.classes[0] : gs.classes;
      if (cls?.grade_level != null) {
        const s = teacherGrades.get(gs.teacher_id) ?? new Set<number>();
        s.add(cls.grade_level);
        teacherGrades.set(gs.teacher_id, s);
      }
    }

    // 7. Build candidate list — bỏ GV gốc
    const originalTeacherId = slot.teacher_id;
    const homeroomTeacherId = slotClass?.homeroom_teacher_id ?? null;

    const candidates: SubstituteCandidate[] = (teachers as { id: string; display_name: string }[])
      .filter((t) => t.id !== originalTeacherId)
      .map((t) => {
        const busy = busyMap.get(t.id) ?? null;
        const isFree = !busy;
        const sameSubject =
          teacherSubjectSet.get(t.id)?.has(slot.subject_id) ?? false;
        const sameGrade =
          slotGrade !== null &&
          (teacherGrades.get(t.id)?.has(slotGrade) ?? false);
        const isHomeroom = homeroomTeacherId === t.id;
        const recent = recentMap.get(t.id) ?? 0;

        let score = 0;
        if (sameSubject) score += 5;
        if (sameGrade) score += 3;
        if (isHomeroom) score += 5;
        score -= Math.min(recent * 2, 10);

        return {
          teacher_id: t.id,
          display_name: t.display_name,
          is_free: isFree,
          same_subject: sameSubject,
          same_grade: sameGrade,
          is_homeroom: isHomeroom,
          recent_substitutions: recent,
          score,
          busy_with: busy,
        };
      });

    // Sort: GV trống lên đầu (sort theo score desc), GV bận xuống cuối.
    candidates.sort((a, b) => {
      if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
      return b.score - a.score;
    });

    return { success: true, data: candidates };
  } catch (e) {
    return err(e);
  }
}

// ── Listing slots cần thay cho 1 ngày ──────────────────────────────────
// Strategy: lấy tất cả timetable_slots với day_of_week khớp date đó,
// KHÔNG có substitution chưa tạo, để admin chọn slot và phân công.
// Cho MVP đơn giản: admin chỉ định teacher_id "nghỉ hôm nay", engine
// liệt kê tiết của teacher đó.

export interface AbsentTeacherSlot {
  slot_id: string;
  day_of_week: number;
  period_id: string;
  period_index: number;
  shift: string | null;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_short: string;
  existing_substitution_id: string | null; // nếu đã có dạy thay
}

export async function listAbsentTeacherSlotsForDate(
  teacherId: string,
  date: string,
): Promise<ActionResult<AbsentTeacherSlot[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    // ISO day_of_week
    const dow = ((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;

    const { data: slots, error: sErr } = await supabase
      .from("timetable_slots")
      .select(
        "id, day_of_week, period_id, class_id, subject_id, periods:period_id(period_number, shift), classes:class_id(name), subjects:subject_id(short_code)",
      )
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", teacherId)
      .eq("day_of_week", dow);

    if (sErr) return { success: false, error: sErr.message };

    const slotIds = (slots ?? []).map((s) => s.id);
    const { data: existing } = await supabase
      .from("substitutions")
      .select("id, timetable_slot_id, date")
      .eq("tenant_id", tenant.id)
      .eq("date", date)
      .in("timetable_slot_id", slotIds);

    const existingMap = new Map<string, string>();
    for (const ex of (existing ?? []) as {
      id: string;
      timetable_slot_id: string;
    }[]) {
      if (ex.timetable_slot_id) existingMap.set(ex.timetable_slot_id, ex.id);
    }

    const out: AbsentTeacherSlot[] = (slots ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => {
        const period = Array.isArray(s.periods) ? s.periods[0] : s.periods;
        const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        const sub = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects;
        return {
          slot_id: s.id,
          day_of_week: s.day_of_week,
          period_id: s.period_id,
          period_index: period?.period_number ?? 0,
          shift: period?.shift ?? null,
          class_id: s.class_id,
          class_name: cls?.name ?? "?",
          subject_id: s.subject_id,
          subject_short: sub?.short_code ?? "?",
          existing_substitution_id: existingMap.get(s.id) ?? null,
        };
      },
    );

    out.sort(
      (a, b) =>
        (a.shift ?? "").localeCompare(b.shift ?? "") ||
        a.period_index - b.period_index,
    );

    return { success: true, data: out };
  } catch (e) {
    return err(e);
  }
}

// ══ ADVANCES ═══════════════════════════════════════════════════════════
// Server creates advance khi admin bấm "Tạm ứng X%" — tách logic ở
// engine module (week 3) để gộp với compute thừa giờ.

export async function listAdvances(
  teacherId: string,
  schoolYearId: string,
): Promise<ActionResult<TeacherOvertimeAdvanceRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("teacher_overtime_advances")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", teacherId)
      .eq("school_year_id", schoolYearId)
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TeacherOvertimeAdvanceRow[] };
  } catch (e) {
    return err(e);
  }
}
