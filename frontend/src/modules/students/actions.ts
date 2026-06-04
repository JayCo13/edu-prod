"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import { nextStudentCode, validateStudentCode } from "./student-code";
import { computePaymentStatus, daysUntilDue, remainingVnd } from "./payment-status";
import type {
  ImportError,
  ImportResult,
  MonthlyAttendanceStat,
  PaymentAlert,
  StudentEnrollmentRow,
  StudentImportRow,
  StudentPaymentRow,
  StudentRow,
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

// ══ STUDENTS CRUD ═════════════════════════════════════════════════════

const StudentSchema = z.object({
  student_code: z.string().trim().max(30).optional().nullable(),
  display_name: z.string().trim().min(1, "Họ tên bắt buộc").max(150),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  gender: z.enum(["M", "F", "OTHER"]).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  parent_name: z.string().trim().max(150).optional().nullable(),
  parent_phone: z.string().trim().max(30).optional().nullable(),
  parent_email: z.string().trim().max(150).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type StudentInput = z.input<typeof StudentSchema>;

export async function listStudents(opts?: {
  search?: string;
  classId?: string | null; // filter: HS đang active trong class
  includeInactive?: boolean;
}): Promise<ActionResult<StudentRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    let query = supabase
      .from("students")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("display_name");

    if (!opts?.includeInactive) query = query.eq("is_active", true);

    if (opts?.search) {
      const s = opts.search.trim();
      // Diacritic-insensitive: search trong display_name + student_code + parent_phone
      query = query.or(
        `display_name.ilike.%${s}%,student_code.ilike.%${s}%,parent_phone.ilike.%${s}%`,
      );
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    let rows = (data ?? []) as StudentRow[];

    // Filter theo class qua enrollments — sub-query khó với ilike, làm 2 step.
    if (opts?.classId) {
      const { data: enr } = await supabase
        .from("student_enrollments")
        .select("student_id")
        .eq("tenant_id", tenant.id)
        .eq("class_id", opts.classId)
        .eq("status", "ACTIVE");
      const ids = new Set((enr ?? []).map((e) => e.student_id));
      rows = rows.filter((s) => ids.has(s.id));
    }

    return { success: true, data: rows };
  } catch (e) {
    return err(e);
  }
}

export async function getStudent(id: string): Promise<ActionResult<StudentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .single();
    if (error || !data) return { success: false, error: error?.message ?? "Không tìm thấy HS." };
    return { success: true, data: data as StudentRow };
  } catch (e) {
    return err(e);
  }
}

export async function createStudent(input: StudentInput): Promise<ActionResult<StudentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = StudentSchema.parse(input);

    let code = (parsed.student_code ?? "").trim();
    if (code) {
      const validErr = validateStudentCode(code);
      if (validErr) return { success: false, error: validErr };
    } else {
      code = await nextStudentCode(supabase, tenant.id);
    }

    const { data, error } = await supabase
      .from("students")
      .insert({
        tenant_id: tenant.id,
        student_code: code,
        display_name: parsed.display_name,
        dob: parsed.dob || null,
        gender: parsed.gender ?? null,
        phone: parsed.phone || null,
        parent_name: parsed.parent_name || null,
        parent_phone: parsed.parent_phone || null,
        parent_email: parsed.parent_email || null,
        address: parsed.address || null,
        note: parsed.note || null,
        is_active: parsed.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Mã HS "${code}" đã tồn tại.` };
      }
      return { success: false, error: error.message };
    }
    revalidatePath("/dashboard/students");
    return { success: true, data: data as StudentRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateStudent(
  id: string,
  input: StudentInput,
): Promise<ActionResult<StudentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = StudentSchema.parse(input);

    const patch: Record<string, unknown> = {
      display_name: parsed.display_name,
      dob: parsed.dob || null,
      gender: parsed.gender ?? null,
      phone: parsed.phone || null,
      parent_name: parsed.parent_name || null,
      parent_phone: parsed.parent_phone || null,
      parent_email: parsed.parent_email || null,
      address: parsed.address || null,
      note: parsed.note || null,
    };
    if (parsed.is_active !== undefined) patch.is_active = parsed.is_active;

    // Cho phép đổi mã HS nếu admin cố tình.
    if (parsed.student_code !== undefined && parsed.student_code !== null) {
      const code = parsed.student_code.trim();
      if (code) {
        const validErr = validateStudentCode(code);
        if (validErr) return { success: false, error: validErr };
        patch.student_code = code;
      }
    }

    const { data, error } = await supabase
      .from("students")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    return { success: true, data: data as StudentRow };
  } catch (e) {
    return err(e);
  }
}

// Xoá hàng loạt HS — chia 2 nhóm:
//   • Có lịch sử (enrollment) → soft delete (is_active=false)
//   • Chưa có lịch sử → hard delete
// Trả về cả 2 số để UI báo "X đã xoá, Y đã ngưng kích hoạt".
export async function bulkDeleteStudents(input: {
  student_ids: string[];
}): Promise<
  ActionResult<{ deleted: number; deactivated: number; errors: number }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.student_ids.length === 0) {
      return { success: false, error: "Chưa chọn học sinh nào." };
    }

    // Xác định HS nào có lịch sử
    const { data: withHistory } = await supabase
      .from("student_enrollments")
      .select("student_id")
      .eq("tenant_id", tenant.id)
      .in("student_id", input.student_ids);
    const hasHistory = new Set(
      ((withHistory ?? []) as Array<{ student_id: string }>).map(
        (r) => r.student_id,
      ),
    );

    const toSoft = input.student_ids.filter((id) => hasHistory.has(id));
    const toHard = input.student_ids.filter((id) => !hasHistory.has(id));

    let deactivated = 0;
    let deleted = 0;
    let errors = 0;

    if (toSoft.length > 0) {
      const { error, count } = await supabase
        .from("students")
        .update({ is_active: false }, { count: "exact" })
        .eq("tenant_id", tenant.id)
        .in("id", toSoft);
      if (error) errors += toSoft.length;
      else deactivated = count ?? toSoft.length;
    }
    if (toHard.length > 0) {
      const { error, count } = await supabase
        .from("students")
        .delete({ count: "exact" })
        .eq("tenant_id", tenant.id)
        .in("id", toHard);
      if (error) {
        // FK error → fallback soft delete
        const { count: softCount } = await supabase
          .from("students")
          .update({ is_active: false }, { count: "exact" })
          .eq("tenant_id", tenant.id)
          .in("id", toHard);
        deactivated += softCount ?? 0;
      } else {
        deleted = count ?? toHard.length;
      }
    }

    revalidatePath("/dashboard/students");
    return { success: true, data: { deleted, deactivated, errors } };
  } catch (e) {
    return err(e);
  }
}

// Bật/tắt is_active hàng loạt — dùng cho "ngừng học tạm thời nguyên lớp"
// hoặc kích hoạt lại nhóm HS đã ngưng.
export async function bulkSetStudentActive(input: {
  student_ids: string[];
  is_active: boolean;
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.student_ids.length === 0) {
      return { success: false, error: "Chưa chọn học sinh nào." };
    }
    const { error, count } = await supabase
      .from("students")
      .update({ is_active: input.is_active }, { count: "exact" })
      .eq("tenant_id", tenant.id)
      .in("id", input.student_ids);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    return { success: true, data: { updated: count ?? input.student_ids.length } };
  } catch (e) {
    return err(e);
  }
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();

    // Soft delete: HS có lịch sử enrollment/payment → set is_active=false thay vì xoá cứng.
    const { count } = await supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", id)
      .eq("tenant_id", tenant.id);

    if ((count ?? 0) > 0) {
      const { error } = await supabase
        .from("students")
        .update({ is_active: false })
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) return { success: false, error: error.message };
    }
    revalidatePath("/dashboard/students");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ══ EXCEL IMPORT ═══════════════════════════════════════════════════════
// UI parse Excel → mảng rows → gọi action này. Mỗi row validate độc lập;
// row hỏng không chặn row khác.
const ImportRowSchema = z.object({
  student_code: z.string().trim().max(30).optional().or(z.literal("")),
  display_name: z.string().trim().min(1).max(150),
  dob: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["Nam", "Nữ", "Khác"]).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  parent_name: z.string().trim().max(150).optional().or(z.literal("")),
  parent_phone: z.string().trim().max(30).optional().or(z.literal("")),
  parent_email: z.string().trim().max(150).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

function parseVnDate(s: string): string | null {
  // Accept DD/MM/YYYY hoặc YYYY-MM-DD.
  const t = s.trim();
  if (!t) return null;
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;
  return null;
}

export async function importStudents(
  rows: StudentImportRow[],
): Promise<ActionResult<ImportResult>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const errors: ImportError[] = [];
    let created = 0;
    let skipped = 0;

    // Lấy 1 lần danh sách mã HS hiện có để check trùng nhanh.
    const { data: existing } = await supabase
      .from("students")
      .select("student_code, display_name, parent_phone")
      .eq("tenant_id", tenant.id);
    const existingCodes = new Set(
      (existing ?? []).map((r) => r.student_code as string),
    );
    const existingNameParentPhone = new Set(
      (existing ?? [])
        .filter((r) => r.display_name && r.parent_phone)
        .map(
          (r) =>
            `${(r.display_name as string).toLowerCase()}|${r.parent_phone as string}`,
        ),
    );

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const parsed = ImportRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({
          row_index: i,
          message: parsed.error.issues
            .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
            .join("; "),
        });
        continue;
      }

      const r = parsed.data;
      const dob = r.dob ? parseVnDate(r.dob) : null;
      if (r.dob && !dob) {
        errors.push({
          row_index: i,
          field: "dob",
          message: `Ngày sinh "${r.dob}" không hợp lệ (DD/MM/YYYY)`,
        });
        continue;
      }

      let code = r.student_code?.trim() || "";
      if (code && existingCodes.has(code)) {
        skipped++;
        continue;
      }
      // Trùng tên + SĐT phụ huynh → skip
      if (
        r.parent_phone &&
        existingNameParentPhone.has(
          `${r.display_name.toLowerCase()}|${r.parent_phone}`,
        )
      ) {
        skipped++;
        continue;
      }
      if (!code) {
        code = await nextStudentCode(supabase, tenant.id);
        // Patch local set để row tiếp theo không trùng auto-code
        existingCodes.add(code);
      }

      const gender =
        r.gender === "Nam" ? "M" : r.gender === "Nữ" ? "F" : r.gender === "Khác" ? "OTHER" : null;

      const { error } = await supabase.from("students").insert({
        tenant_id: tenant.id,
        student_code: code,
        display_name: r.display_name,
        dob,
        gender,
        phone: r.phone || null,
        parent_name: r.parent_name || null,
        parent_phone: r.parent_phone || null,
        parent_email: r.parent_email || null,
        address: r.address || null,
        note: r.note || null,
      });
      if (error) {
        errors.push({
          row_index: i,
          message: error.message,
        });
        continue;
      }
      existingCodes.add(code);
      if (r.parent_phone) {
        existingNameParentPhone.add(
          `${r.display_name.toLowerCase()}|${r.parent_phone}`,
        );
      }
      created++;
    }

    revalidatePath("/dashboard/students");
    return { success: true, data: { created, skipped, errors } };
  } catch (e) {
    return err(e);
  }
}

// ══ ENROLLMENT ════════════════════════════════════════════════════════

const EnrollmentSchema = z.object({
  student_id: z.string().uuid(),
  class_id: z.string().uuid(),
  enrolled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tuition_amount_vnd: z.number().int().nonnegative().nullable().optional(),
  billing_cycle: z.enum(["MONTHLY", "PER_SESSION", "ANNUAL", "ONE_TIME"]).nullable().optional(),
  payment_day: z.number().int().min(1).max(31).nullable().optional(),
  note: z.string().max(500).optional().nullable(),
});

export type EnrollmentInput = z.input<typeof EnrollmentSchema>;

export async function listEnrollments(opts?: {
  studentId?: string;
  classId?: string;
  status?: "ACTIVE" | "ALL";
}): Promise<ActionResult<StudentEnrollmentRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    let q = supabase
      .from("student_enrollments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("enrolled_at", { ascending: false });
    if (opts?.studentId) q = q.eq("student_id", opts.studentId);
    if (opts?.classId) q = q.eq("class_id", opts.classId);
    if (!opts?.status || opts.status === "ACTIVE") q = q.eq("status", "ACTIVE");
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as StudentEnrollmentRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function enrollStudent(
  input: EnrollmentInput,
): Promise<ActionResult<StudentEnrollmentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = EnrollmentSchema.parse(input);

    // Validate HS thuộc tenant.
    const { data: stu } = await supabase
      .from("students")
      .select("id")
      .eq("id", parsed.student_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!stu) return { success: false, error: "Học sinh không tồn tại trong trung tâm." };

    // Validate class thuộc tenant.
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", parsed.class_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cls) return { success: false, error: "Lớp không tồn tại trong trung tâm." };

    // Check đã active trong lớp này chưa.
    const { data: dup } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("student_id", parsed.student_id)
      .eq("class_id", parsed.class_id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (dup) return { success: false, error: "Học sinh đang học trong lớp này rồi." };

    const { data, error } = await supabase
      .from("student_enrollments")
      .insert({
        tenant_id: tenant.id,
        student_id: parsed.student_id,
        class_id: parsed.class_id,
        enrolled_at: parsed.enrolled_at,
        tuition_amount_vnd: parsed.tuition_amount_vnd ?? null,
        billing_cycle: parsed.billing_cycle ?? "MONTHLY",
        payment_day: parsed.payment_day ?? null,
        note: parsed.note ?? null,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    return { success: true, data: data as StudentEnrollmentRow };
  } catch (e) {
    return err(e);
  }
}

// Bulk enroll — đăng ký nhiều HS vào 1 lớp với cùng tuition/billing.
// Mỗi HS có thể edit sau qua updateEnrollment (chưa làm) hoặc xoá +
// tạo lại. Đối với UX add hàng loạt từ trang lớp.
export async function bulkEnrollStudents(input: {
  class_id: string;
  student_ids: string[];
  enrolled_at: string;
  tuition_amount_vnd?: number | null;
  billing_cycle?: "MONTHLY" | "PER_SESSION" | "ANNUAL" | "ONE_TIME" | null;
  payment_day?: number | null;
  note?: string | null;
}): Promise<
  ActionResult<{
    enrolled: number;
    skipped_already_in_class: number;
    not_found: number;
  }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.student_ids.length === 0) {
      return { success: false, error: "Chưa chọn học sinh nào." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.enrolled_at)) {
      return { success: false, error: "Ngày đăng ký không hợp lệ." };
    }

    // Validate class thuộc tenant.
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", input.class_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cls) return { success: false, error: "Lớp không tồn tại trong trung tâm." };

    // Bóc HS thực sự thuộc tenant — 1 query.
    const { data: stus } = await supabase
      .from("students")
      .select("id")
      .eq("tenant_id", tenant.id)
      .in("id", input.student_ids);
    const validIds = new Set((stus ?? []).map((s) => s.id as string));
    const notFound = input.student_ids.length - validIds.size;

    // Lọc HS đã ACTIVE trong lớp — 1 query.
    const { data: existing } = await supabase
      .from("student_enrollments")
      .select("student_id")
      .eq("tenant_id", tenant.id)
      .eq("class_id", input.class_id)
      .eq("status", "ACTIVE")
      .in("student_id", [...validIds]);
    const alreadyIn = new Set(
      (existing ?? []).map((e) => e.student_id as string),
    );
    const toInsert = [...validIds].filter((id) => !alreadyIn.has(id));

    if (toInsert.length === 0) {
      return {
        success: true,
        data: {
          enrolled: 0,
          skipped_already_in_class: alreadyIn.size,
          not_found: notFound,
        },
      };
    }

    const rows = toInsert.map((sid) => ({
      tenant_id: tenant.id,
      student_id: sid,
      class_id: input.class_id,
      enrolled_at: input.enrolled_at,
      tuition_amount_vnd: input.tuition_amount_vnd ?? null,
      billing_cycle: input.billing_cycle ?? "MONTHLY",
      payment_day: input.payment_day ?? null,
      note: input.note ?? null,
      status: "ACTIVE" as const,
    }));

    const { error } = await supabase.from("student_enrollments").insert(rows);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath(`/dashboard/classes/${input.class_id}`);
    return {
      success: true,
      data: {
        enrolled: toInsert.length,
        skipped_already_in_class: alreadyIn.size,
        not_found: notFound,
      },
    };
  } catch (e) {
    return err(e);
  }
}

// Chuyển lớp: enrollment cũ → TRANSFERRED, tạo enrollment mới ACTIVE.
export async function transferStudent(input: {
  current_enrollment_id: string;
  new_class_id: string;
  effective_date: string; // YYYY-MM-DD
  carry_over_tuition?: boolean; // copy tuition + billing_cycle từ cũ
  note?: string | null;
}): Promise<ActionResult<{ new_enrollment: StudentEnrollmentRow }>> {
  try {
    const { supabase, tenant } = await requireAdmin();

    const { data: cur } = await supabase
      .from("student_enrollments")
      .select("*")
      .eq("id", input.current_enrollment_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cur) return { success: false, error: "Enrollment không tồn tại." };
    if ((cur as StudentEnrollmentRow).status !== "ACTIVE") {
      return { success: false, error: "Enrollment hiện tại không ở trạng thái ACTIVE." };
    }
    if ((cur as StudentEnrollmentRow).class_id === input.new_class_id) {
      return { success: false, error: "Lớp mới trùng với lớp hiện tại." };
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", input.new_class_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cls) return { success: false, error: "Lớp mới không tồn tại trong trung tâm." };

    // Bước 1: đánh dấu enrollment cũ TRANSFERRED
    const { error: updErr } = await supabase
      .from("student_enrollments")
      .update({
        status: "TRANSFERRED",
        withdrawn_at: input.effective_date,
      })
      .eq("id", input.current_enrollment_id)
      .eq("tenant_id", tenant.id);
    if (updErr) return { success: false, error: updErr.message };

    // Bước 2: tạo enrollment mới
    const old = cur as StudentEnrollmentRow;
    const { data: created, error: insErr } = await supabase
      .from("student_enrollments")
      .insert({
        tenant_id: tenant.id,
        student_id: old.student_id,
        class_id: input.new_class_id,
        enrolled_at: input.effective_date,
        tuition_amount_vnd: input.carry_over_tuition
          ? old.tuition_amount_vnd
          : null,
        billing_cycle: input.carry_over_tuition ? old.billing_cycle : "MONTHLY",
        payment_day: input.carry_over_tuition ? old.payment_day : null,
        transferred_from_enrollment_id: input.current_enrollment_id,
        note: input.note ?? null,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (insErr) {
      // Rollback bước 1
      await supabase
        .from("student_enrollments")
        .update({ status: "ACTIVE", withdrawn_at: null })
        .eq("id", input.current_enrollment_id);
      return { success: false, error: insErr.message };
    }

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    return {
      success: true,
      data: { new_enrollment: created as StudentEnrollmentRow },
    };
  } catch (e) {
    return err(e);
  }
}

export async function withdrawEnrollment(input: {
  enrollment_id: string;
  effective_date: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("student_enrollments")
      .update({
        status: "WITHDRAWN",
        withdrawn_at: input.effective_date,
        note: input.reason ?? undefined,
      })
      .eq("id", input.enrollment_id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ══ PAYMENTS ═══════════════════════════════════════════════════════════

const PaymentSchema = z.object({
  student_id: z.string().uuid(),
  enrollment_id: z.string().uuid().nullable().optional(),
  amount_vnd: z.number().int().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_label: z.string().max(50).optional().default(""),
  note: z.string().max(500).optional().nullable(),
});

export type PaymentInput = z.input<typeof PaymentSchema>;

export async function listPaymentsForStudent(
  studentId: string,
): Promise<ActionResult<StudentPaymentRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("student_payments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("student_id", studentId)
      .order("due_date", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as StudentPaymentRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createPayment(
  input: PaymentInput,
): Promise<ActionResult<StudentPaymentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = PaymentSchema.parse(input);
    const { data, error } = await supabase
      .from("student_payments")
      .insert({
        tenant_id: tenant.id,
        student_id: parsed.student_id,
        enrollment_id: parsed.enrollment_id ?? null,
        amount_vnd: parsed.amount_vnd,
        due_date: parsed.due_date,
        period_label: parsed.period_label ?? "",
        note: parsed.note ?? null,
        status: "PENDING",
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    return { success: true, data: data as StudentPaymentRow };
  } catch (e) {
    return err(e);
  }
}

export async function markPaymentPaid(input: {
  payment_id: string;
  amount_vnd?: number; // mặc định = full
  paid_date?: string; // mặc định today
  method?: string;
  receipt_no?: string;
}): Promise<ActionResult<StudentPaymentRow>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data: cur } = await supabase
      .from("student_payments")
      .select("*")
      .eq("id", input.payment_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!cur) return { success: false, error: "Không tìm thấy khoản thu." };
    const p = cur as StudentPaymentRow;
    const addAmount = input.amount_vnd ?? remainingVnd(p);
    if (addAmount <= 0) return { success: false, error: "Khoản này đã đóng đủ." };

    const newPaid = Number(p.paid_amount_vnd ?? 0) + addAmount;
    const total = Number(p.amount_vnd);
    const newStatus = newPaid >= total ? "PAID" : "PARTIAL";
    const paidDate = input.paid_date ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("student_payments")
      .update({
        paid_amount_vnd: newPaid,
        paid_date: paidDate,
        status: newStatus,
        payment_method: input.method ?? p.payment_method,
        receipt_no: input.receipt_no ?? p.receipt_no,
      })
      .eq("id", input.payment_id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    return { success: true, data: data as StudentPaymentRow };
  } catch (e) {
    return err(e);
  }
}

// Bulk generate khoản thu cho enrollment MONTHLY trong khoảng [start, end].
// Dành cho admin tạo trước 3-6 tháng học phí cho cả lớp.
//
// Logic:
//   • Lấy enrollment ACTIVE (filter class_id nếu có)
//   • Bỏ qua enrollment billing_cycle ≠ MONTHLY (PER_SESSION/ANNUAL
//     có model khác)
//   • Bỏ qua enrollment tuition_amount_vnd null/0
//   • Mỗi tháng → due_date = year-month-payment_day (clamp ngày cuối
//     tháng nếu payment_day vượt — vd. 31 cho tháng 2 → 28/29)
//   • Dedup: nếu (student_id, due_date) đã có payment → skip
//   • Sinh period_label tự động "Tháng MM/YYYY"
const BulkPaymentsSchema = z
  .object({
    class_id: z.string().uuid().optional(),
    start_month: z.string().regex(/^\d{4}-\d{2}$/),
    end_month: z.string().regex(/^\d{4}-\d{2}$/),
    default_payment_day: z.number().int().min(1).max(31).optional(),
  })
  .refine((d) => d.start_month <= d.end_month, {
    message: "Tháng bắt đầu phải ≤ tháng kết thúc.",
  });

export type BulkPaymentsInput = z.input<typeof BulkPaymentsSchema>;

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 24) break; // cap 24 tháng
  }
  return out;
}

function clampDayOfMonth(year: number, month1: number, day: number): number {
  const last = new Date(year, month1, 0).getDate(); // month1 = 1-12
  return Math.min(day, last);
}

export async function previewBulkPayments(input: BulkPaymentsInput): Promise<
  ActionResult<{
    months: string[];
    eligible_enrollments: number;
    will_create: number;
    will_skip_existing: number;
    skip_no_tuition: number;
    skip_non_monthly: number;
  }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = BulkPaymentsSchema.parse(input);
    const months = monthsBetween(parsed.start_month, parsed.end_month);

    // Lấy enrollments ACTIVE — chuẩn bị filter theo class nếu có
    let q = supabase
      .from("student_enrollments")
      .select("id, student_id, tuition_amount_vnd, billing_cycle, payment_day")
      .eq("tenant_id", tenant.id)
      .eq("status", "ACTIVE");
    if (parsed.class_id) q = q.eq("class_id", parsed.class_id);
    const { data: enrs, error: enrErr } = await q;
    if (enrErr) return { success: false, error: enrErr.message };

    const list = (enrs ?? []) as Array<{
      id: string;
      student_id: string;
      tuition_amount_vnd: number | null;
      billing_cycle: string | null;
      payment_day: number | null;
    }>;
    const monthly = list.filter((e) => (e.billing_cycle ?? "MONTHLY") === "MONTHLY");
    const skipNonMonthly = list.length - monthly.length;
    const eligible = monthly.filter(
      (e) => (e.tuition_amount_vnd ?? 0) > 0,
    );
    const skipNoTuition = monthly.length - eligible.length;

    // Build target due dates per enrollment
    const targets: Array<{ enrollment_id: string; student_id: string; due_date: string }> = [];
    for (const e of eligible) {
      const payDay =
        e.payment_day ?? parsed.default_payment_day ?? 5;
      for (const ym of months) {
        const [y, m] = ym.split("-").map(Number);
        const day = clampDayOfMonth(y, m, payDay);
        const due = `${ym}-${String(day).padStart(2, "0")}`;
        targets.push({
          enrollment_id: e.id,
          student_id: e.student_id,
          due_date: due,
        });
      }
    }

    if (targets.length === 0) {
      return {
        success: true,
        data: {
          months,
          eligible_enrollments: eligible.length,
          will_create: 0,
          will_skip_existing: 0,
          skip_no_tuition: skipNoTuition,
          skip_non_monthly: skipNonMonthly,
        },
      };
    }

    // Check existing
    const studentIds = [...new Set(targets.map((t) => t.student_id))];
    const dueDates = [...new Set(targets.map((t) => t.due_date))];
    const { data: existing } = await supabase
      .from("student_payments")
      .select("student_id, due_date")
      .eq("tenant_id", tenant.id)
      .in("student_id", studentIds)
      .in("due_date", dueDates);
    const existSet = new Set(
      (existing ?? []).map(
        (r: { student_id: string; due_date: string }) =>
          `${r.student_id}::${r.due_date}`,
      ),
    );
    const willCreate = targets.filter(
      (t) => !existSet.has(`${t.student_id}::${t.due_date}`),
    ).length;
    const willSkip = targets.length - willCreate;

    return {
      success: true,
      data: {
        months,
        eligible_enrollments: eligible.length,
        will_create: willCreate,
        will_skip_existing: willSkip,
        skip_no_tuition: skipNoTuition,
        skip_non_monthly: skipNonMonthly,
      },
    };
  } catch (e) {
    return err(e);
  }
}

export async function bulkGeneratePayments(
  input: BulkPaymentsInput,
): Promise<
  ActionResult<{
    created: number;
    skipped_existing: number;
    skip_no_tuition: number;
    skip_non_monthly: number;
  }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const parsed = BulkPaymentsSchema.parse(input);
    const months = monthsBetween(parsed.start_month, parsed.end_month);

    let q = supabase
      .from("student_enrollments")
      .select("id, student_id, tuition_amount_vnd, billing_cycle, payment_day")
      .eq("tenant_id", tenant.id)
      .eq("status", "ACTIVE");
    if (parsed.class_id) q = q.eq("class_id", parsed.class_id);
    const { data: enrs, error: enrErr } = await q;
    if (enrErr) return { success: false, error: enrErr.message };

    const list = (enrs ?? []) as Array<{
      id: string;
      student_id: string;
      tuition_amount_vnd: number | null;
      billing_cycle: string | null;
      payment_day: number | null;
    }>;
    const monthly = list.filter((e) => (e.billing_cycle ?? "MONTHLY") === "MONTHLY");
    const skipNonMonthly = list.length - monthly.length;
    const eligible = monthly.filter((e) => (e.tuition_amount_vnd ?? 0) > 0);
    const skipNoTuition = monthly.length - eligible.length;

    type Target = {
      enrollment_id: string;
      student_id: string;
      due_date: string;
      amount: number;
      period_label: string;
    };

    const targets: Target[] = [];
    for (const e of eligible) {
      const payDay = e.payment_day ?? parsed.default_payment_day ?? 5;
      for (const ym of months) {
        const [y, m] = ym.split("-").map(Number);
        const day = clampDayOfMonth(y, m, payDay);
        const due = `${ym}-${String(day).padStart(2, "0")}`;
        targets.push({
          enrollment_id: e.id,
          student_id: e.student_id,
          due_date: due,
          amount: Number(e.tuition_amount_vnd),
          period_label: `Tháng ${String(m).padStart(2, "0")}/${y}`,
        });
      }
    }

    if (targets.length === 0) {
      return {
        success: true,
        data: {
          created: 0,
          skipped_existing: 0,
          skip_no_tuition: skipNoTuition,
          skip_non_monthly: skipNonMonthly,
        },
      };
    }

    // Dedup vs existing (student_id, due_date)
    const studentIds = [...new Set(targets.map((t) => t.student_id))];
    const dueDates = [...new Set(targets.map((t) => t.due_date))];
    const { data: existing } = await supabase
      .from("student_payments")
      .select("student_id, due_date")
      .eq("tenant_id", tenant.id)
      .in("student_id", studentIds)
      .in("due_date", dueDates);
    const existSet = new Set(
      (existing ?? []).map(
        (r: { student_id: string; due_date: string }) =>
          `${r.student_id}::${r.due_date}`,
      ),
    );
    const toInsert = targets.filter(
      (t) => !existSet.has(`${t.student_id}::${t.due_date}`),
    );

    if (toInsert.length === 0) {
      return {
        success: true,
        data: {
          created: 0,
          skipped_existing: targets.length,
          skip_no_tuition: skipNoTuition,
          skip_non_monthly: skipNonMonthly,
        },
      };
    }

    const rows = toInsert.map((t) => ({
      tenant_id: tenant.id,
      student_id: t.student_id,
      enrollment_id: t.enrollment_id,
      amount_vnd: t.amount,
      due_date: t.due_date,
      paid_amount_vnd: 0,
      status: "PENDING" as const,
      period_label: t.period_label,
    }));

    const { error: insErr } = await supabase
      .from("student_payments")
      .insert(rows);
    if (insErr) return { success: false, error: insErr.message };

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/payments");
    return {
      success: true,
      data: {
        created: toInsert.length,
        skipped_existing: targets.length - toInsert.length,
        skip_no_tuition: skipNoTuition,
        skip_non_monthly: skipNonMonthly,
      },
    };
  } catch (e) {
    return err(e);
  }
}

// Bulk huỷ — đặt status = CANCELLED, GIỮ history. Dùng khi admin tạo
// nhầm hoặc HS nghỉ học không phải trả khoản đó.
// Khoản đã PAID không nên huỷ — trả lỗi rõ nếu có.
export async function bulkCancelPayments(input: {
  payment_ids: string[];
}): Promise<
  ActionResult<{ cancelled: number; skipped_paid: number; errors: number }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.payment_ids.length === 0) {
      return { success: false, error: "Chưa chọn khoản nào." };
    }

    // Lọc khoản đã PAID — không cancel
    const { data: paidRows } = await supabase
      .from("student_payments")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .in("id", input.payment_ids)
      .eq("status", "PAID");
    const paidSet = new Set(
      ((paidRows ?? []) as Array<{ id: string }>).map((r) => r.id),
    );
    const toCancel = input.payment_ids.filter((id) => !paidSet.has(id));

    if (toCancel.length === 0) {
      return {
        success: true,
        data: { cancelled: 0, skipped_paid: paidSet.size, errors: 0 },
      };
    }

    const { error, count } = await supabase
      .from("student_payments")
      .update({ status: "CANCELLED" }, { count: "exact" })
      .eq("tenant_id", tenant.id)
      .in("id", toCancel);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/students");
    return {
      success: true,
      data: {
        cancelled: count ?? toCancel.length,
        skipped_paid: paidSet.size,
        errors: 0,
      },
    };
  } catch (e) {
    return err(e);
  }
}

// Bulk delete — XOÁ CỨNG, dùng khi tạo nhầm hàng loạt (vd. chạy
// bulkGeneratePayments với tháng sai). Khoản đã PAID không xoá.
export async function bulkDeletePayments(input: {
  payment_ids: string[];
}): Promise<
  ActionResult<{ deleted: number; skipped_paid: number; errors: number }>
> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (input.payment_ids.length === 0) {
      return { success: false, error: "Chưa chọn khoản nào." };
    }

    const { data: paidRows } = await supabase
      .from("student_payments")
      .select("id")
      .eq("tenant_id", tenant.id)
      .in("id", input.payment_ids)
      .eq("status", "PAID");
    const paidSet = new Set(
      ((paidRows ?? []) as Array<{ id: string }>).map((r) => r.id),
    );
    const toDelete = input.payment_ids.filter((id) => !paidSet.has(id));

    if (toDelete.length === 0) {
      return {
        success: true,
        data: { deleted: 0, skipped_paid: paidSet.size, errors: 0 },
      };
    }

    const { error, count } = await supabase
      .from("student_payments")
      .delete({ count: "exact" })
      .eq("tenant_id", tenant.id)
      .in("id", toDelete);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/students");
    return {
      success: true,
      data: {
        deleted: count ?? toDelete.length,
        skipped_paid: paidSet.size,
        errors: 0,
      },
    };
  } catch (e) {
    return err(e);
  }
}

export async function cancelPayment(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { error } = await supabase
      .from("student_payments")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/students");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// Cảnh báo: sắp tới hạn (≤ N ngày) + quá hạn — dashboard widget.
export async function listPaymentAlerts(opts?: {
  warningWindowDays?: number; // mặc định 7
}): Promise<ActionResult<PaymentAlert[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const window = opts?.warningWindowDays ?? 7;
    const horizon = new Date(today.getTime() + window * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: payments, error } = await supabase
      .from("student_payments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .in("status", ["PENDING", "PARTIAL", "OVERDUE"])
      .lte("due_date", horizon)
      .order("due_date");
    if (error) return { success: false, error: error.message };

    const rows = (payments ?? []) as StudentPaymentRow[];
    if (!rows.length) return { success: true, data: [] };

    const studentIds = [...new Set(rows.map((r) => r.student_id))];
    const enrollmentIds = [
      ...new Set(rows.map((r) => r.enrollment_id).filter(Boolean)),
    ] as string[];

    const [{ data: stus }, { data: enrs }] = await Promise.all([
      supabase
        .from("students")
        .select("id, student_code, display_name, parent_phone")
        .in("id", studentIds),
      enrollmentIds.length
        ? supabase
            .from("student_enrollments")
            .select("id, class_id")
            .in("id", enrollmentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; class_id: string }> }),
    ]);

    const classIds = [
      ...new Set(
        (enrs ?? [])
          .map((e: { class_id: string | null }) => e.class_id)
          .filter(Boolean) as string[],
      ),
    ];
    const { data: clss } = classIds.length
      ? await supabase.from("classes").select("id, name").in("id", classIds)
      : { data: [] as Array<{ id: string; name: string }> };

    const stuMap = new Map(
      ((stus ?? []) as Array<{
        id: string;
        student_code: string;
        display_name: string;
        parent_phone: string | null;
      }>).map((s) => [s.id, s]),
    );
    const enrMap = new Map(
      ((enrs ?? []) as Array<{ id: string; class_id: string | null }>).map((e) => [
        e.id,
        e.class_id,
      ]),
    );
    const classMap = new Map(
      ((clss ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
    );

    const alerts: PaymentAlert[] = rows
      .map((p) => {
        const stu = stuMap.get(p.student_id);
        if (!stu) return null;
        const classId = p.enrollment_id ? enrMap.get(p.enrollment_id) ?? null : null;
        const className = classId ? classMap.get(classId) ?? null : null;
        const computedStatus = computePaymentStatus({ ...p, status: p.status }, today);
        return {
          payment: { ...p, status: computedStatus },
          student: {
            id: stu.id,
            student_code: stu.student_code,
            display_name: stu.display_name,
            parent_phone: stu.parent_phone,
          },
          class_name: className,
          remaining_vnd: remainingVnd(p),
          days_until_due: daysUntilDue(p.due_date, today),
        } satisfies PaymentAlert;
      })
      .filter((x): x is PaymentAlert => x !== null)
      // Sort: quá hạn nặng nhất trước, sau đến sắp tới hạn gần nhất
      .sort((a, b) => a.days_until_due - b.days_until_due);

    // Filter cuối: còn tiền cần thu + (sắp đến hạn HOẶC đã quá hạn).
    // SELECT đã giới hạn due_date ≤ horizon nên dữ liệu đầu vào hợp lệ;
    // chỉ cần loại item nào đã đóng đủ qua paid_amount_vnd.
    const filtered = alerts.filter((a) => a.remaining_vnd > 0);
    void todayStr;
    return { success: true, data: filtered };
  } catch (e) {
    return err(e);
  }
}

// ══ ATTENDANCE ═════════════════════════════════════════════════════════

const AttendanceMarkSchema = z.object({
  session_id: z.string().uuid(),
  rows: z.array(
    z.object({
      student_id: z.string().uuid(),
      enrollment_id: z.string().uuid().nullable().optional(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      note: z.string().max(500).optional().nullable(),
    }),
  ),
});

export async function markAttendance(
  input: z.input<typeof AttendanceMarkSchema>,
): Promise<ActionResult<{ marked: number }>> {
  try {
    const { supabase, tenant, userId } = await requireAdmin();
    const parsed = AttendanceMarkSchema.parse(input);

    // Validate session thuộc tenant.
    const { data: sess } = await supabase
      .from("live_sessions")
      .select("id, tenant_id")
      .eq("id", parsed.session_id)
      .eq("tenant_id", tenant.id)
      .single();
    if (!sess) return { success: false, error: "Buổi học không tồn tại trong trung tâm." };

    // Upsert: (session_id, student_id) UNIQUE → reload nhanh.
    const payload = parsed.rows.map((r) => ({
      tenant_id: tenant.id,
      session_id: parsed.session_id,
      student_id: r.student_id,
      enrollment_id: r.enrollment_id ?? null,
      status: r.status,
      note: r.note ?? null,
      recorded_at: new Date().toISOString(),
      recorded_by: userId,
    }));

    const { error } = await supabase
      .from("student_attendance")
      .upsert(payload, { onConflict: "session_id,student_id" });
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/classes");
    return { success: true, data: { marked: parsed.rows.length } };
  } catch (e) {
    return err(e);
  }
}

export async function listAttendanceForSession(
  sessionId: string,
): Promise<ActionResult<Array<{ student_id: string; status: string; note: string | null }>>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data, error } = await supabase
      .from("student_attendance")
      .select("student_id, status, note")
      .eq("session_id", sessionId)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (e) {
    return err(e);
  }
}

// Báo cáo "số buổi HS đã học trong tháng thuộc lớp nào".
// Tham số month = YYYY-MM. Filter HS = active hoặc đã từng có enrollment.
export async function monthlyAttendanceReport(input: {
  month: string; // "2026-06"
  classId?: string | null;
}): Promise<ActionResult<MonthlyAttendanceStat[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      return { success: false, error: "Định dạng tháng phải là YYYY-MM." };
    }
    const monthStart = `${input.month}-01`;
    const [yy, mm] = input.month.split("-").map(Number);
    const nextMonth = new Date(yy, mm, 1); // mm là 1-indexed → trỏ đúng tháng kế
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    // Lấy mọi attendance trong tháng
    const { data: atts, error } = await supabase
      .from("student_attendance")
      .select(
        "id, student_id, session_id, enrollment_id, status, live_sessions!inner(start_time, class_id)",
      )
      .eq("tenant_id", tenant.id)
      .gte("live_sessions.start_time", monthStart)
      .lt("live_sessions.start_time", monthEnd);
    if (error) return { success: false, error: error.message };

    // PostgREST type embeds as array; runtime is single object cho 1:1 FK.
    // Cast 2 lần qua unknown để TS không complain.
    const rows = (atts ?? []) as unknown as Array<{
      id: string;
      student_id: string;
      session_id: string;
      enrollment_id: string | null;
      status: string;
      live_sessions: { start_time: string; class_id: string | null };
    }>;

    // Gom theo (student × class). Lấy class từ session.class_id; fallback
    // qua enrollment khi session chưa tag class.
    const enrollmentClass = new Map<string, string>();
    const missingClassEnrIds = [
      ...new Set(
        rows
          .filter((r) => !r.live_sessions.class_id && r.enrollment_id)
          .map((r) => r.enrollment_id as string),
      ),
    ];
    if (missingClassEnrIds.length > 0) {
      const { data: enr } = await supabase
        .from("student_enrollments")
        .select("id, class_id")
        .in("id", missingClassEnrIds);
      for (const e of (enr ?? []) as Array<{ id: string; class_id: string }>) {
        enrollmentClass.set(e.id, e.class_id);
      }
    }

    const grouped = new Map<
      string,
      {
        student_id: string;
        class_id: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();
    for (const r of rows) {
      const classId =
        r.live_sessions.class_id ??
        (r.enrollment_id ? enrollmentClass.get(r.enrollment_id) : null);
      if (!classId) continue;
      if (input.classId && classId !== input.classId) continue;
      const key = `${r.student_id}::${classId}`;
      const g =
        grouped.get(key) ??
        {
          student_id: r.student_id,
          class_id: classId,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      if (r.status === "PRESENT") g.present++;
      else if (r.status === "ABSENT") g.absent++;
      else if (r.status === "LATE") g.late++;
      else if (r.status === "EXCUSED") g.excused++;
      grouped.set(key, g);
    }

    if (grouped.size === 0) return { success: true, data: [] };

    const studentIds = [...new Set([...grouped.values()].map((g) => g.student_id))];
    const classIds = [...new Set([...grouped.values()].map((g) => g.class_id))];

    const [{ data: stus }, { data: clss }] = await Promise.all([
      supabase
        .from("students")
        .select("id, student_code, display_name")
        .in("id", studentIds),
      supabase.from("classes").select("id, name").in("id", classIds),
    ]);

    const stuMap = new Map(
      ((stus ?? []) as Array<{ id: string; student_code: string; display_name: string }>).map((s) => [s.id, s]),
    );
    const classMap = new Map(
      ((clss ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
    );

    const result: MonthlyAttendanceStat[] = [...grouped.values()].map((g) => ({
      student_id: g.student_id,
      student_code: stuMap.get(g.student_id)?.student_code ?? "",
      display_name: stuMap.get(g.student_id)?.display_name ?? "",
      class_id: g.class_id,
      class_name: classMap.get(g.class_id) ?? "",
      month: input.month,
      present_count: g.present,
      absent_count: g.absent,
      late_count: g.late,
      excused_count: g.excused,
      total_count: g.present + g.absent + g.late + g.excused,
    }));

    // Sort: class theo tên, trong class theo HS tên
    result.sort((a, b) => {
      if (a.class_name !== b.class_name) return a.class_name.localeCompare(b.class_name);
      return a.display_name.localeCompare(b.display_name);
    });

    return { success: true, data: result };
  } catch (e) {
    return err(e);
  }
}
