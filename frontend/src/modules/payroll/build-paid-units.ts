import "server-only";

import { resolveActualMinutes, scheduledMinutes } from "./calculator";
import {
  getCoTeachShare,
  matchRateRule,
  type RateResolverInputs,
} from "./rate-resolution";
import type { TeacherSnapshot } from "./domain-types";
import type { PaidUnit, PayrollRules, Session } from "./types";

/**
 * Build `paid_units[]` cho 1 teacher trên các sessions trong kỳ.
 *
 * Logic:
 *   1. Lọc sessions trong period (date range).
 *   2. Mỗi session: lấy share = pay_share_pct (co-teach hoặc 100% solo).
 *   3. Nếu share = 0 → bỏ qua (teacher không liên quan buổi này).
 *   4. Resolve rate via matchRateRule. Fallback to teacher snapshot rate
 *      nếu không có rule match (defensive — sau migration 0037 luôn có
 *      TEACHER_DEFAULT row).
 *   5. Quyết định status:
 *      - CANCELLED + reason cho pay → CANCELLED_PAID, actual = scheduled × completion
 *      - CANCELLED + reason không trả → skip
 *      - COMPLETED → tính actual_minutes như cũ
 *      - SCHEDULED / IN_PROGRESS → skip (chưa hoàn tất)
 */
export interface BuildPaidUnitsInput {
  teacher: TeacherSnapshot;
  sessions: Session[];
  period: { start: string; end: string };
  rules: PayrollRules;
  resolverInputs: RateResolverInputs;
}

export function buildPaidUnits(input: BuildPaidUnitsInput): PaidUnit[] {
  const { teacher, sessions, period, rules, resolverInputs } = input;
  const units: PaidUnit[] = [];

  for (const session of sessions) {
    // (1) period filter
    if (session.date < period.start || session.date > period.end) continue;

    // (2) co-teach share
    const share = getCoTeachShare(
      resolverInputs,
      session.id,
      teacher.id,
      session.assigned_teacher_id,
    );
    if (share <= 0) continue;

    // (3) status + cancellation policy
    let status: PaidUnit["status"];
    let actualMinutes: number;

    if (session.status === "COMPLETED") {
      status = "COMPLETED";
      actualMinutes = resolveActualMinutes(session, rules).minutes;
    } else if (session.status === "CANCELLED") {
      const reason = session.cancellation_reason ?? null;
      const shouldPay = reason ? (rules.pay_on_cancel[reason] ?? false) : false;
      if (!shouldPay) continue;
      status = "CANCELLED_PAID";
      // Buổi huỷ "vẫn trả": không có check-in/out → fallback scheduled
      // × completion_factor.
      actualMinutes = Math.floor(
        scheduledMinutes(session) * rules.completion_factor,
      );
    } else {
      // SCHEDULED / IN_PROGRESS / RESCHEDULED → chưa tính
      continue;
    }

    // (4) resolve rate
    const resolved = matchRateRule(resolverInputs, teacher.id, session);
    const rate = resolved ?? {
      rule_id: null,
      rule_scope: "TEACHER_DEFAULT" as const,
      scope_id: null,
      payment_structure: teacher.payment_structure,
      hourly_rate: teacher.hourly_rate,
      per_session_rate: teacher.per_session_rate,
      fixed_monthly_amount: teacher.fixed_monthly_amount,
    };

    units.push({
      session_id: session.id,
      date: session.date,
      scheduled_minutes: scheduledMinutes(session),
      actual_minutes: actualMinutes,
      status,
      pay_share_pct: share,
      resolved_rate: rate,
    });
  }

  return units;
}
