import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StoredAdjustment } from "./domain-types";

/**
 * Recurring adjustments — phụ cấp / khấu trừ định kỳ.
 *
 * Module cô lập hoàn toàn với rate resolution. Hàm `applyRecurringForPeriod`
 * chỉ trả về StoredAdjustment[] đã resolve cho từng teacher trong kỳ;
 * service payroll dùng kết quả này như một nguồn adjustment bổ sung,
 * KHÔNG đụng tới `calculated_amount` của calculator.
 *
 * Decrement của `N_PERIODS_LEFT` xảy ra ở `markAppliedOnApprove` —
 * gọi tách riêng khi kỳ chuyển sang APPROVED, không phải lúc tạo DRAFT.
 */

export type RecurringCycle = "EVERY" | "UNTIL_DATE" | "N_PERIODS_LEFT";
export type RecurringType = "BONUS" | "DEDUCTION";

export interface RecurringAdjustmentRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  type: RecurringType;
  amount_vnd: number;
  reason: string;
  cycle: RecurringCycle;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  remaining_periods: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Resolution: rule → adjustment cho 1 kỳ cụ thể ────────────────────────

interface PeriodWindow {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

function isApplicable(
  rule: RecurringAdjustmentRow,
  period: PeriodWindow,
): boolean {
  if (!rule.is_active) return false;

  // Rule phải bắt đầu trước khi kỳ kết thúc.
  if (rule.effective_from > period.end) return false;

  switch (rule.cycle) {
    case "EVERY":
      return true;
    case "UNTIL_DATE":
      // Còn hiệu lực nếu effective_to >= period.start (overlap).
      return rule.effective_to !== null && rule.effective_to >= period.start;
    case "N_PERIODS_LEFT":
      return (rule.remaining_periods ?? 0) > 0;
  }
}

function ruleToAdjustment(rule: RecurringAdjustmentRow): StoredAdjustment {
  return {
    id: `rec_${rule.id}_${Date.now()}`,
    type: rule.type,
    amount: rule.amount_vnd,
    reason: rule.reason,
    created_at: new Date().toISOString(),
    created_by: rule.created_by,
    recurring_rule_id: rule.id,
  };
}

/** Lấy các adjustment định kỳ áp dụng cho kỳ này, group theo teacher_id.
 *  Dùng admin client (bypass RLS) vì service đang chạy ở context admin
 *  rồi — không cần check thêm tầng. */
export async function applyRecurringForPeriod(
  supabase: SupabaseClient,
  tenantId: string,
  period: PeriodWindow,
): Promise<Map<string, StoredAdjustment[]>> {
  const { data, error } = await supabase
    .from("recurring_adjustments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const grouped = new Map<string, StoredAdjustment[]>();
  for (const row of (data ?? []) as RecurringAdjustmentRow[]) {
    if (!isApplicable(row, period)) continue;
    const list = grouped.get(row.teacher_id) ?? [];
    list.push(ruleToAdjustment(row));
    grouped.set(row.teacher_id, list);
  }
  return grouped;
}

/** Khi kỳ lương chuyển sang APPROVED, giảm `remaining_periods` của các
 *  rule N_PERIODS_LEFT đã áp. Giảm ở tầng service vì không có trigger
 *  tự nhận biết. Truyền vào danh sách `rule_id` được dùng cho kỳ này
 *  (tự ghi nhận từ snapshot adjustments lúc tạo). */
export async function decrementRemainingForApprovedPeriod(
  supabase: SupabaseClient,
  ruleIds: string[],
): Promise<void> {
  if (ruleIds.length === 0) return;

  // Fetch các rule N_PERIODS_LEFT, decrement từng cái.
  const { data, error } = await supabase
    .from("recurring_adjustments")
    .select("id, cycle, remaining_periods")
    .in("id", ruleIds);
  if (error) throw new Error(error.message);

  const updates = (data ?? [])
    .filter(
      (r) =>
        r.cycle === "N_PERIODS_LEFT" &&
        typeof r.remaining_periods === "number" &&
        r.remaining_periods > 0,
    )
    .map((r) => ({
      id: r.id as string,
      remaining_periods: (r.remaining_periods as number) - 1,
    }));

  // Update từng dòng riêng (supabase JS không có atomic decrement built-in).
  // Số rule N_PERIODS_LEFT trong 1 kỳ thường <10, nên loop OK.
  for (const u of updates) {
    const { error: updErr } = await supabase
      .from("recurring_adjustments")
      .update({
        remaining_periods: u.remaining_periods,
        // Tự deactivate khi về 0 để không gây nhiễu UI.
        is_active: u.remaining_periods > 0,
      })
      .eq("id", u.id);
    if (updErr) throw new Error(updErr.message);
  }
}

/** Lấy danh sách rule_id đã được snapshot vào adjustments của 1 kỳ. */
export function ruleIdsAppliedInPeriod(
  itemsAdjustments: { adjustments: StoredAdjustment[] }[],
): string[] {
  const ids = new Set<string>();
  for (const it of itemsAdjustments) {
    for (const adj of it.adjustments) {
      if (adj.recurring_rule_id) ids.add(adj.recurring_rule_id);
    }
  }
  return Array.from(ids);
}
