import "server-only";

import type { PayrollBreakdown, PayrollResult } from "./types";

/**
 * So sánh kết quả 2 engine cùng 1 teacher × 1 kỳ.
 * Output: `diff_summary` lưu vào payroll_engine_shadow_diffs.
 *
 * Heuristic reason_hint:
 *   • Nếu paid_units_snapshot bên NEW có >= 1 rule scope ≠ TEACHER_DEFAULT
 *     → "có rule override scope=X"
 *   • Nếu paid_units có pay_share_pct < 100 → "có co-teaching"
 *   • Cả hai → kết hợp
 *   • Nếu diff = 0 → null
 *   • Nếu diff != 0 nhưng không tìm được lý do → "engine mới khác — review breakdown"
 */

export interface DiffField {
  old: number;
  new: number;
  delta: number;
}

export interface DiffSummary {
  final_amount: DiffField;
  // Chỉ list các field có chênh — fields khác omit.
  hourly_pay?: DiffField;
  per_session_pay?: DiffField;
  fixed_monthly_pay?: DiffField;
  bonuses?: DiffField;
  deductions?: DiffField;
  automatic_penalties?: DiffField;
  sessions_paid?: DiffField;
  hours_taught_minutes?: DiffField;
  reason_hint: string | null;
}

function pickIfDifferent(
  old: number,
  next: number,
): DiffField | undefined {
  if (old === next) return undefined;
  return { old, new: next, delta: next - old };
}

export function compareBreakdowns(
  oldResult: PayrollResult,
  newResult: PayrollResult,
): DiffSummary {
  const o = oldResult.breakdown;
  const n = newResult.breakdown;

  const final: DiffField = {
    old: oldResult.final_amount,
    new: newResult.final_amount,
    delta: newResult.final_amount - oldResult.final_amount,
  };

  const summary: DiffSummary = {
    final_amount: final,
    hourly_pay: pickIfDifferent(o.hourly_pay, n.hourly_pay),
    per_session_pay: pickIfDifferent(o.per_session_pay, n.per_session_pay),
    fixed_monthly_pay: pickIfDifferent(o.fixed_monthly_pay, n.fixed_monthly_pay),
    bonuses: pickIfDifferent(o.bonuses, n.bonuses),
    deductions: pickIfDifferent(o.deductions, n.deductions),
    automatic_penalties: pickIfDifferent(
      o.automatic_penalties,
      n.automatic_penalties,
    ),
    sessions_paid: pickIfDifferent(o.sessions_paid, n.sessions_paid),
    hours_taught_minutes: pickIfDifferent(
      o.hours_taught_minutes,
      n.hours_taught_minutes,
    ),
    reason_hint: buildReasonHint(final.delta, n),
  };

  return summary;
}

function buildReasonHint(
  delta: number,
  newBreakdown: PayrollBreakdown,
): string | null {
  if (delta === 0) return null;

  const units = newBreakdown.paid_units_snapshot ?? [];
  const overrideScopes = new Set<string>();
  let hasCoTeach = false;
  for (const u of units) {
    if (u.resolved_rate.rule_scope !== "TEACHER_DEFAULT") {
      overrideScopes.add(u.resolved_rate.rule_scope);
    }
    if (u.pay_share_pct < 100) hasCoTeach = true;
  }

  const parts: string[] = [];
  if (overrideScopes.size > 0) {
    parts.push(
      `có rule override scope=${Array.from(overrideScopes).join(",")}`,
    );
  }
  if (hasCoTeach) parts.push("có co-teaching split");
  if (parts.length === 0) {
    return "Engine mới ra số khác — review breakdown để xác nhận";
  }
  return parts.join(", ");
}
