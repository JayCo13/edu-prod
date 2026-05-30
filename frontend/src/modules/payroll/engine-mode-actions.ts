"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import {
  buildRequestMetadata,
  logAuditEntry,
} from "@/modules/audit/service";

export type EngineMode = "OLD" | "SHADOW" | "NEW";

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

function err(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
  return { success: false, error: msg };
}

export async function getPayrollEngineMode(): Promise<
  ActionResult<{ mode: EngineMode }>
> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xem được cài đặt." };
    }
    const { data } = await supabase
      .from("tenants")
      .select("payroll_engine_mode")
      .eq("id", tenant.id)
      .single();
    return {
      success: true,
      data: { mode: (data?.payroll_engine_mode as EngineMode) ?? "OLD" },
    };
  } catch (e) {
    return err(e);
  }
}

const modeSchema = z.object({ mode: z.enum(["OLD", "SHADOW", "NEW"]) });

export async function setPayrollEngineMode(
  input: z.infer<typeof modeSchema>,
): Promise<ActionResult> {
  try {
    const parsed = modeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Chế độ không hợp lệ." };

    const { supabase, tenant, isAdmin, userId } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên đổi được chế độ." };
    }

    const { data: before } = await supabase
      .from("tenants")
      .select("payroll_engine_mode")
      .eq("id", tenant.id)
      .single();
    const oldMode = (before?.payroll_engine_mode as EngineMode) ?? "OLD";

    if (oldMode === parsed.data.mode) {
      return { success: true };
    }

    const { error } = await supabase
      .from("tenants")
      .update({ payroll_engine_mode: parsed.data.mode })
      .eq("id", tenant.id);
    if (error) return { success: false, error: error.message };

    // Audit: ai đổi từ X sang Y lúc nào.
    try {
      await logAuditEntry({
        center_id: tenant.id,
        user_id: userId,
        action: "tenant.payroll_engine.change",
        entity_type: "tenant",
        entity_id: tenant.id,
        before: { payroll_engine_mode: oldMode },
        after: { payroll_engine_mode: parsed.data.mode },
        metadata: await buildRequestMetadata({}),
      });
    } catch (e) {
      // Audit lỗi không nên block — log warn.
      console.warn("[payroll] engine mode audit log failed:", e);
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/payroll");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
