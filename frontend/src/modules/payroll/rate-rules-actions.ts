"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

function err(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
  return { success: false, error: msg };
}

// ── Schema ────────────────────────────────────────────────────────────────

const ruleSchema = z
  .object({
    teacher_id: z.string().uuid("ID giáo viên không hợp lệ."),
    scope: z.enum(["TEACHER_DEFAULT", "COURSE", "CLASS"]),
    scope_id: z.string().uuid().nullable().optional(),
    payment_structure: z.enum(["HOURLY", "PER_SESSION", "FIXED_MONTHLY", "HYBRID"]),
    hourly_rate: z.number().int().min(0).nullable().optional(),
    per_session_rate: z.number().int().min(0).nullable().optional(),
    fixed_monthly_amount: z.number().int().min(0).nullable().optional(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
    effective_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.")
      .nullable()
      .optional(),
    priority: z.number().int().min(0).max(1000).default(0),
  })
  .refine(
    (d) =>
      (d.scope === "TEACHER_DEFAULT" && !d.scope_id) ||
      (d.scope !== "TEACHER_DEFAULT" && !!d.scope_id),
    {
      message:
        "Phạm vi Khoá / Lớp phải kèm ID; Phạm vi 'Mặc định' không có ID.",
      path: ["scope_id"],
    },
  )
  .refine(
    (d) => !d.effective_to || d.effective_to >= d.effective_from,
    {
      message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
      path: ["effective_to"],
    },
  );

export type RateRuleInput = z.infer<typeof ruleSchema>;

export interface RateRuleRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  scope: "TEACHER_DEFAULT" | "COURSE" | "CLASS";
  scope_id: string | null;
  payment_structure: "HOURLY" | "PER_SESSION" | "FIXED_MONTHLY" | "HYBRID";
  hourly_rate: number | null;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

// ── Actions ───────────────────────────────────────────────────────────────

export async function listRateRules(
  teacherId?: string,
): Promise<ActionResult<RateRuleRow[]>> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xem được đơn giá." };
    }
    let q = supabase
      .from("rate_rules")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("teacher_id", { ascending: true })
      .order("scope", { ascending: false }) // CLASS > COURSE > TEACHER_DEFAULT
      .order("created_at", { ascending: false });
    if (teacherId) q = q.eq("teacher_id", teacherId);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as RateRuleRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function createRateRule(
  input: RateRuleInput,
): Promise<ActionResult<RateRuleRow>> {
  try {
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }
    const { supabase, tenant, isAdmin, userId } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên tạo được đơn giá." };
    }

    const payload = {
      tenant_id: tenant.id,
      teacher_id: parsed.data.teacher_id,
      scope: parsed.data.scope,
      scope_id: parsed.data.scope === "TEACHER_DEFAULT" ? null : parsed.data.scope_id,
      payment_structure: parsed.data.payment_structure,
      hourly_rate: parsed.data.hourly_rate ?? null,
      per_session_rate: parsed.data.per_session_rate ?? null,
      fixed_monthly_amount: parsed.data.fixed_monthly_amount ?? null,
      effective_from: parsed.data.effective_from,
      effective_to: parsed.data.effective_to ?? null,
      priority: parsed.data.priority,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from("rate_rules")
      .insert(payload)
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/payroll/rates");
    return { success: true, data: data as RateRuleRow };
  } catch (e) {
    return err(e);
  }
}

export async function updateRateRule(
  id: string,
  input: RateRuleInput,
): Promise<ActionResult<RateRuleRow>> {
  try {
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên sửa được đơn giá." };
    }

    const payload = {
      teacher_id: parsed.data.teacher_id,
      scope: parsed.data.scope,
      scope_id: parsed.data.scope === "TEACHER_DEFAULT" ? null : parsed.data.scope_id,
      payment_structure: parsed.data.payment_structure,
      hourly_rate: parsed.data.hourly_rate ?? null,
      per_session_rate: parsed.data.per_session_rate ?? null,
      fixed_monthly_amount: parsed.data.fixed_monthly_amount ?? null,
      effective_from: parsed.data.effective_from,
      effective_to: parsed.data.effective_to ?? null,
      priority: parsed.data.priority,
    };

    const { data, error } = await supabase
      .from("rate_rules")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/payroll/rates");
    return { success: true, data: data as RateRuleRow };
  } catch (e) {
    return err(e);
  }
}

export async function deleteRateRule(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xóa được đơn giá." };
    }
    const { error } = await supabase
      .from("rate_rules")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/payroll/rates");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
