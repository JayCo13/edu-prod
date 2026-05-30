"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import type {
  RecurringAdjustmentRow,
  RecurringCycle,
  RecurringType,
} from "./recurring-adjustments";

// ── Result types ──────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

function err(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
  return { success: false, error: msg };
}

// ── Schema ────────────────────────────────────────────────────────────────

const inputSchema = z
  .object({
    teacher_id: z.string().uuid("ID giáo viên không hợp lệ."),
    type: z.enum(["BONUS", "DEDUCTION"]),
    amount_vnd: z
      .number()
      .int("Số tiền phải là số nguyên.")
      .positive("Số tiền phải lớn hơn 0."),
    reason: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập lý do.")
      .max(200, "Lý do quá dài (tối đa 200 ký tự)."),
    cycle: z.enum(["EVERY", "UNTIL_DATE", "N_PERIODS_LEFT"]),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
    effective_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.")
      .nullable()
      .optional(),
    remaining_periods: z
      .number()
      .int()
      .min(1, "Số kỳ còn lại phải ≥ 1.")
      .nullable()
      .optional(),
  })
  .refine(
    (d) => d.cycle !== "UNTIL_DATE" || !!d.effective_to,
    {
      message: "Chu kỳ 'Đến ngày' phải có ngày kết thúc.",
      path: ["effective_to"],
    },
  )
  .refine(
    (d) =>
      d.cycle !== "N_PERIODS_LEFT" ||
      (typeof d.remaining_periods === "number" && d.remaining_periods >= 1),
    {
      message: "Chu kỳ 'N kỳ còn lại' phải có số kỳ ≥ 1.",
      path: ["remaining_periods"],
    },
  );

export type RecurringAdjustmentInput = z.infer<typeof inputSchema>;

// ── Actions ───────────────────────────────────────────────────────────────

export async function listRecurringAdjustments(
  teacherId?: string,
): Promise<ActionResult<RecurringAdjustmentRow[]>> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xem được phụ cấp định kỳ." };
    }
    let query = supabase
      .from("recurring_adjustments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (teacherId) query = query.eq("teacher_id", teacherId);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as RecurringAdjustmentRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createRecurringAdjustment(
  input: RecurringAdjustmentInput,
): Promise<ActionResult<RecurringAdjustmentRow>> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }
    const { supabase, tenant, isAdmin, userId } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên tạo được phụ cấp định kỳ." };
    }

    const payload = {
      tenant_id: tenant.id,
      teacher_id: parsed.data.teacher_id,
      type: parsed.data.type as RecurringType,
      amount_vnd: parsed.data.amount_vnd,
      reason: parsed.data.reason,
      cycle: parsed.data.cycle as RecurringCycle,
      effective_from: parsed.data.effective_from,
      effective_to: parsed.data.cycle === "UNTIL_DATE" ? parsed.data.effective_to : null,
      remaining_periods:
        parsed.data.cycle === "N_PERIODS_LEFT" ? parsed.data.remaining_periods : null,
      is_active: true,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from("recurring_adjustments")
      .insert(payload)
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/teachers");
    return { success: true, data: data as RecurringAdjustmentRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateRecurringAdjustment(
  id: string,
  input: RecurringAdjustmentInput,
): Promise<ActionResult<RecurringAdjustmentRow>> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên sửa được phụ cấp định kỳ." };
    }

    const payload = {
      teacher_id: parsed.data.teacher_id,
      type: parsed.data.type as RecurringType,
      amount_vnd: parsed.data.amount_vnd,
      reason: parsed.data.reason,
      cycle: parsed.data.cycle as RecurringCycle,
      effective_from: parsed.data.effective_from,
      effective_to: parsed.data.cycle === "UNTIL_DATE" ? parsed.data.effective_to : null,
      remaining_periods:
        parsed.data.cycle === "N_PERIODS_LEFT" ? parsed.data.remaining_periods : null,
    };

    const { data, error } = await supabase
      .from("recurring_adjustments")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/teachers");
    return { success: true, data: data as RecurringAdjustmentRow };
  } catch (e) {
    return err(e);
  }
}

export async function toggleRecurringAdjustment(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên đổi trạng thái được." };
    }
    const { error } = await supabase
      .from("recurring_adjustments")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

export async function deleteRecurringAdjustment(
  id: string,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xóa được phụ cấp định kỳ." };
    }
    const { error } = await supabase
      .from("recurring_adjustments")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/teachers");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
