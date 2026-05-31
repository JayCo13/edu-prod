"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import {
  calculateSchoolYearPayrollForTeacher,
  type SchoolPayrollResult,
} from "./engine";

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

// ── Compute kết quả lương cho 1 GV ────────────────────────────────────

export async function previewSchoolPayrollForTeacher(
  teacherId: string,
  schoolYearId: string,
): Promise<ActionResult<SchoolPayrollResult>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const result = await calculateSchoolYearPayrollForTeacher(supabase, {
      tenantId: tenant.id,
      teacherId,
      schoolYearId,
    });
    return { success: true, data: result };
  } catch (e) {
    return err(e);
  }
}

// ── Compute toàn trường ───────────────────────────────────────────────

export interface SchoolPayrollSummaryRow {
  teacher_id: string;
  teacher_name: string;
  total_actual_periods: number;
  quota_periods: number;
  overtime_paid: number;
  overtime_uncovered: number;
  overtime_total_pay_vnd: number;
  total_advances_vnd: number;
  net_settlement_vnd: number;
  error?: string;
}

export async function previewSchoolPayrollForAllTeachers(
  schoolYearId: string,
): Promise<ActionResult<SchoolPayrollSummaryRow[]>> {
  try {
    const { supabase, tenant } = await requireAdmin();
    const { data: teachers } = await supabase
      .from("tenant_teachers")
      .select("id, display_name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    if (!teachers) return { success: true, data: [] };

    const summaries: SchoolPayrollSummaryRow[] = [];
    for (const t of teachers as { id: string; display_name: string }[]) {
      try {
        const r = await calculateSchoolYearPayrollForTeacher(supabase, {
          tenantId: tenant.id,
          teacherId: t.id,
          schoolYearId,
        });
        summaries.push({
          teacher_id: t.id,
          teacher_name: t.display_name,
          total_actual_periods: r.total_actual_periods,
          quota_periods: r.quota.effective_periods_per_year,
          overtime_paid: r.overtime_paid,
          overtime_uncovered: r.overtime_uncovered,
          overtime_total_pay_vnd: r.overtime_total_pay_vnd,
          total_advances_vnd: r.total_advances_vnd,
          net_settlement_vnd: r.net_settlement_vnd,
        });
      } catch (e) {
        summaries.push({
          teacher_id: t.id,
          teacher_name: t.display_name,
          total_actual_periods: 0,
          quota_periods: 0,
          overtime_paid: 0,
          overtime_uncovered: 0,
          overtime_total_pay_vnd: 0,
          total_advances_vnd: 0,
          net_settlement_vnd: 0,
          error: e instanceof Error ? e.message : "Lỗi tính lương",
        });
      }
    }
    return { success: true, data: summaries };
  } catch (e) {
    return err(e);
  }
}

// ── Tạm ứng — admin tạo payroll_period riêng + ghi advance ───────────

const advanceSchema = z.object({
  teacher_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  advance_amount_vnd: z.number().int().min(1),
  notes: z.string().max(500).optional(),
});

export async function createOvertimeAdvance(
  input: z.infer<typeof advanceSchema>,
): Promise<ActionResult> {
  try {
    const parsed = advanceSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0]?.message ?? "" };
    const { supabase, tenant, userId } = await requireAdmin();

    // Snapshot số tiết tích lũy tại thời điểm tạm ứng.
    const calc = await calculateSchoolYearPayrollForTeacher(supabase, {
      tenantId: tenant.id,
      teacherId: parsed.data.teacher_id,
      schoolYearId: parsed.data.school_year_id,
    });

    // Cảnh báo nếu tạm ứng > số dư còn lại.
    const remaining = calc.overtime_total_pay_vnd - calc.total_advances_vnd;
    if (parsed.data.advance_amount_vnd > remaining && remaining > 0) {
      // Vẫn cho phép (admin quyết) — chỉ ghi vào notes.
    }

    // Tạo payroll_period riêng cho tạm ứng. Reuse table sẵn có.
    const { data: period, error: pErr } = await supabase
      .from("payroll_periods")
      .insert({
        center_id: tenant.id,
        period_start: new Date().toISOString().slice(0, 10),
        period_end: new Date().toISOString().slice(0, 10),
        status: "APPROVED",
        notes: `Tạm ứng thừa giờ${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (pErr || !period) {
      return {
        success: false,
        error: pErr?.message ?? "Không tạo được kỳ tạm ứng.",
      };
    }

    const { error: aErr } = await supabase
      .from("teacher_overtime_advances")
      .insert({
        tenant_id: tenant.id,
        teacher_id: parsed.data.teacher_id,
        school_year_id: parsed.data.school_year_id,
        payroll_period_id: (period as { id: string }).id,
        advance_amount_vnd: parsed.data.advance_amount_vnd,
        cumulative_periods_at_advance: calc.overtime_paid,
        cumulative_overtime_amount_at_advance: calc.overtime_total_pay_vnd,
        notes: parsed.data.notes,
        created_by: userId,
      });
    if (aErr) return { success: false, error: aErr.message };

    revalidatePath("/admin/school-payroll");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
