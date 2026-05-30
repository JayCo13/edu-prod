/**
 * Payroll calculator — Phase B implementation.
 *
 * Pure function. No DB, no UI, no I/O. Currency math in integer VND
 * throughout; time math in integer minutes. The only float-tolerated
 * operation is `Math.floor(minutes × rate / 60)` which is always
 * floor'd back to integer immediately.
 *
 * Reference: PRD §5.8 "Payroll (KILLER FEATURE)" + Appendix A.
 */

import type {
  AuditEntry,
  ManualAdjustment,
  PayrollBreakdown,
  PayrollInput,
  PayrollResult,
  PayrollRules,
  Session,
  Teacher,
} from "./types";

// ─── Named constants ─────────────────────────────────────────────────────────

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;
/** PRD §5.8: "Hours = (check-out − check-in) capped at session duration × 1.1". */
const DEFAULT_OVERTIME_CAP_MULTIPLIER = 1.1; // documentary — config wins
/** Statuses that count toward pay. */
const PAYABLE_STATUSES = new Set<Session["status"]>(["COMPLETED"]);
/** Statuses we explicitly skip-with-audit so admins see "why this session didn't pay". */
const SKIPPED_STATUSES = new Set<Session["status"]>([
  "CANCELLED",
  "RESCHEDULED",
]);

// ─── Pure helpers ────────────────────────────────────────────────────────────

/**
 * PRD §5.6: sessions belong to a date in the center's timezone, stored as
 * YYYY-MM-DD. Period bounds are inclusive dates in that same tz. A
 * lexicographic compare on YYYY-MM-DD is exactly the right filter — no UTC
 * conversion required, which is what lets test 15 work.
 */
function inPeriod(s: Session, start: string, end: string): boolean {
  return s.date >= start && s.date <= end;
}

/** Scheduled length in integer minutes. Wraps midnight if end < start. */
function scheduledMinutes(s: Session): number {
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  const startMin = sh * MINUTES_PER_HOUR + sm;
  const endMin = eh * MINUTES_PER_HOUR + em;
  const diff = endMin - startMin;
  return diff >= 0 ? diff : diff + MINUTES_PER_DAY;
}

/** Integer minute delta between two ISO timestamps (both with offsets). */
function minutesBetween(fromIso: string, toIso: string): number {
  return Math.floor(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_MINUTE,
  );
}

/**
 * PRD §5.8 hour resolution:
 *   - if check-in + check-out recorded → actual = clamp(checkout − checkin, [0, scheduled × cap])
 *   - else → scheduled × completion_factor
 *
 * `capped` flips so the audit trail can record HOURS_CAPPED when the
 * teacher stayed longer than the cap allows.
 */
function resolveActualMinutes(
  s: Session,
  rules: PayrollRules,
): { minutes: number; capped: boolean; fellBack: boolean } {
  const scheduled = scheduledMinutes(s);

  if (s.teacher_checkin_at && s.teacher_checkout_at) {
    const raw = minutesBetween(s.teacher_checkin_at, s.teacher_checkout_at);
    const cap = Math.floor(scheduled * rules.hours_cap_multiplier);
    if (raw > cap) return { minutes: cap, capped: true, fellBack: false };
    return { minutes: Math.max(0, raw), capped: false, fellBack: false };
  }

  // PRD §5.8: "If no check-in/out recorded, use scheduled duration × completion factor"
  return {
    minutes: Math.floor(scheduled * rules.completion_factor),
    capped: false,
    fellBack: true,
  };
}

/**
 * Minutes the teacher checked in past the scheduled start. 0 if early/on-time.
 * Uses the tz offset embedded in the check-in ISO so we don't have to know
 * the center's IANA zone here.
 */
function lateMinutesFor(s: Session): number {
  if (!s.teacher_checkin_at) return 0;

  const offsetMatch = s.teacher_checkin_at.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset =
    !offsetMatch || offsetMatch[1] === "Z" ? "+00:00" : offsetMatch[1];
  const scheduledIso = `${s.date}T${s.start_time}:00${offset}`;
  const diff = minutesBetween(scheduledIso, s.teacher_checkin_at);
  return Math.max(0, diff);
}

/** 1 = solo session; 2+ = co-teaching. */
function teacherCount(s: Session): number {
  return 1 + (s.co_teacher_ids?.length ?? 0);
}

/**
 * PRD §5.8: "Multi-teacher session (co-teaching): split pay configurable."
 * For EQUAL: each teacher gets pay / N (floor to integer VND).
 * For PRIMARY_FULL: the assigned_teacher_id keeps the whole amount; co-teachers
 * get nothing (this matters if we were also computing co-teacher payroll —
 * here we only compute the input teacher's share).
 */
function applyCoTeacherSplit(
  pay: number,
  s: Session,
  rules: PayrollRules,
): number {
  const n = teacherCount(s);
  if (n <= 1) return pay;
  if (rules.co_teacher_split === "EQUAL") {
    return Math.floor(pay / n);
  }
  // PRIMARY_FULL: input teacher is the primary (assigned_teacher_id matched).
  return pay;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { teacher, sessions, adjustments, period, rules } = input;
  const audit: AuditEntry[] = [];

  let hoursMinutes = 0;
  let sessionsPaid = 0;
  let hourlyPay = 0;
  let perSessionPay = 0;
  let fixedMonthlyPay = 0;
  let automaticPenalties = 0;

  // PRD §5.8: "Substituted sessions: pay goes to substitute, not original
  // teacher." We enforce this purely via assigned_teacher_id — that field
  // is the authoritative "who taught this" at completion time, so the
  // substitute filter is automatic and needs no special branch.
  const ownSessions = sessions.filter(
    (s) => s.assigned_teacher_id === teacher.id,
  );

  for (const s of ownSessions) {
    if (!inPeriod(s, period.start, period.end)) continue;

    if (SKIPPED_STATUSES.has(s.status)) {
      // PRD §5.8 + Migration 0036: huỷ buổi → tra `pay_on_cancel`
      // theo `cancellation_reason`. Mặc định BY_TEACHER không trả;
      // BY_CENTER / FORCE_MAJEURE trả; BY_STUDENT cấu hình.
      // RESCHEDULED vẫn skip vô điều kiện (buổi đã được dời, bản gốc
      // không tính — buổi mới sẽ tính riêng).
      const reason = s.cancellation_reason ?? null;
      const shouldPay =
        s.status === "CANCELLED" && reason
          ? (rules.pay_on_cancel[reason] ?? false)
          : false;

      if (!shouldPay) {
        audit.push({
          kind: "SESSION_SKIPPED",
          session_id: s.id,
          amount: 0,
          reason: reason
            ? `Bỏ qua: huỷ — ${reason}`
            : `Bỏ qua: trạng thái ${s.status}`,
        });
        continue;
      }

      // Buổi huỷ "trả tiền": tính như scheduled, không có check-in/out
      // (force-fallback completion_factor). Audit ghi rõ lý do.
      audit.push({
        kind: "SESSION_PAID_DESPITE_CANCEL",
        session_id: s.id,
        amount: 0,
        reason: `Vẫn trả lương dù huỷ — lý do: ${reason}`,
      });
      // Fall through to payment logic — engine sẽ dùng scheduled minutes
      // × completion_factor vì không có check-in.
    } else if (!PAYABLE_STATUSES.has(s.status)) {
      continue; // SCHEDULED / IN_PROGRESS — chưa tính
    }

    sessionsPaid += 1;

    // ── Time resolution (PRD §5.8 hours block) ────────────────────────
    const { minutes, capped } = resolveActualMinutes(s, rules);
    // PRD §5.8 partial sessions: pro-rate — handled implicitly by using
    // actual minutes (capped) rather than scheduled minutes.
    hoursMinutes += minutes;

    if (capped) {
      audit.push({
        kind: "HOURS_CAPPED",
        session_id: s.id,
        amount: 0,
        reason: `Giờ thực tế vượt ${rules.hours_cap_multiplier}× thời lượng — đã giới hạn`,
      });
    }

    // ── HOURLY / HYBRID hourly component ──────────────────────────────
    // PRD §5.8: "Hours taught × Hourly rate".
    if (
      teacher.payment_structure === "HOURLY" ||
      teacher.payment_structure === "HYBRID"
    ) {
      const grossHourly = Math.floor(
        (minutes * teacher.hourly_rate) / MINUTES_PER_HOUR,
      );
      const share = applyCoTeacherSplit(grossHourly, s, rules);

      if (share !== grossHourly) {
        audit.push({
          kind: "CO_TEACHER_SPLIT",
          session_id: s.id,
          amount: share - grossHourly, // negative: shows the reduction
          reason: `Chia ${rules.co_teacher_split} cho ${teacherCount(s)} giáo viên`,
        });
      }

      hourlyPay += share;
      audit.push({
        kind: "SESSION_PAY",
        session_id: s.id,
        amount: share,
        reason: `${s.date} · ${minutes} phút × ${teacher.hourly_rate.toLocaleString("vi-VN")}đ/giờ`,
      });
    }

    // ── PER_SESSION / HYBRID per-session component ────────────────────
    // PRD §5.8: "Sessions taught × Per-session rate".
    if (
      teacher.payment_structure === "PER_SESSION" ||
      teacher.payment_structure === "HYBRID"
    ) {
      const grossPer = teacher.per_session_rate ?? 0;
      const share = applyCoTeacherSplit(grossPer, s, rules);

      // Only emit a separate audit row for pure PER_SESSION; HYBRID already
      // got a SESSION_PAY entry above.
      if (teacher.payment_structure === "PER_SESSION") {
        if (share !== grossPer) {
          audit.push({
            kind: "CO_TEACHER_SPLIT",
            session_id: s.id,
            amount: share - grossPer,
            reason: `Chia ${rules.co_teacher_split} cho ${teacherCount(s)} giáo viên`,
          });
        }
        audit.push({
          kind: "SESSION_PAY",
          session_id: s.id,
          amount: share,
          reason: `${s.date} · ${grossPer.toLocaleString("vi-VN")}đ/buổi`,
        });
      }

      perSessionPay += share;
    }

    // ── Late check-in penalty (PRD §5.8: configurable) ────────────────
    if (rules.late_penalty_per_minute > 0 && s.teacher_checkin_at) {
      const late = lateMinutesFor(s);
      const billable = Math.max(0, late - rules.late_grace_minutes);
      if (billable > 0) {
        const penalty = billable * rules.late_penalty_per_minute;
        automaticPenalties += penalty;
        audit.push({
          kind: "LATE_PENALTY",
          session_id: s.id,
          amount: -penalty,
          reason: `Đi trễ ${late} phút (vượt ${rules.late_grace_minutes} phút cho phép)`,
        });
      }
    }
  }

  // ── FIXED_MONTHLY / HYBRID monthly base ─────────────────────────────
  // PRD §5.8: "Fixed monthly salary [if FIXED_MONTHLY]". Added after the
  // session loop because it's independent of session count.
  if (
    teacher.payment_structure === "FIXED_MONTHLY" ||
    teacher.payment_structure === "HYBRID"
  ) {
    fixedMonthlyPay = teacher.fixed_monthly_amount ?? 0;
    if (fixedMonthlyPay > 0) {
      audit.push({
        kind: "FIXED_MONTHLY_PAY",
        amount: fixedMonthlyPay,
        reason: `Lương cố định kỳ ${period.start} → ${period.end}`,
      });
    }
  }

  // ── Manual adjustments (PRD §5.8: "+ Bonuses − Deductions") ─────────
  let bonuses = 0;
  let deductions = 0;
  for (const adj of adjustments as ManualAdjustment[]) {
    if (adj.type === "BONUS") {
      bonuses += adj.amount;
      audit.push({ kind: "BONUS", amount: adj.amount, reason: adj.reason });
    } else {
      deductions += adj.amount;
      audit.push({
        kind: "DEDUCTION",
        amount: -adj.amount,
        reason: adj.reason,
      });
    }
  }

  // ── Final amount (PRD §5.8 calculated_amount = pre-adjustment gross) ─
  const calculatedAmount = hourlyPay + perSessionPay + fixedMonthlyPay;
  const raw = calculatedAmount + bonuses - deductions - automaticPenalties;

  // Centers never receive money from teachers — clamp at 0.
  let finalAmount = raw;
  if (raw < 0) {
    audit.push({
      kind: "NEGATIVE_CLAMP",
      amount: -raw, // how much we "absorbed" to get back to zero
      reason: `Tổng âm (${raw.toLocaleString("vi-VN")}đ) — đã giới hạn về 0`,
    });
    finalAmount = 0;
  }

  const breakdown: PayrollBreakdown = {
    hours_taught_minutes: hoursMinutes,
    sessions_paid: sessionsPaid,
    hourly_pay: hourlyPay,
    per_session_pay: perSessionPay,
    fixed_monthly_pay: fixedMonthlyPay,
    bonuses,
    deductions,
    automatic_penalties: automaticPenalties,
    calculated_amount: calculatedAmount,
  };

  return {
    teacher_id: teacher.id,
    period,
    breakdown,
    final_amount: finalAmount,
    audit_trail: audit,
  };
}

// Documentary: keep these exported as part of the module API contract so
// admins / settings UI can reference the same default the calculator
// would use when a rules row is missing.
export const PAYROLL_DEFAULTS = {
  hours_cap_multiplier: DEFAULT_OVERTIME_CAP_MULTIPLIER,
} as const;

// ─── NEW: calculatePayrollFromUnits — rate_rules + co-teaching path ──────
//
// Pure function. Mỗi PaidUnit đã mang sẵn rate riêng (resolved từ
// rate_rules) + share % (co-teaching). Engine iterate units, áp dụng
// 4 cấu trúc lương theo từng unit, tổng dồn.
//
// CO-TEACHING POLICY: share áp cho HOURLY + PER_SESSION. FIXED_MONTHLY
// KHÔNG chia (lương cứng tháng không quy theo buổi) — toàn bộ phần
// fixed_monthly_amount cộng đủ một lần dù co-teach nhiều người.

import type { PaidUnit, Period as PaidPeriod } from "./types";

export interface PayrollFromUnitsInput {
  teacher_id: string;
  paid_units: PaidUnit[];
  adjustments: ManualAdjustment[];
  period: PaidPeriod;
  rules: PayrollRules;
}

export function calculatePayrollFromUnits(
  input: PayrollFromUnitsInput,
): PayrollResult {
  const { teacher_id, paid_units, adjustments, period, rules } = input;

  const audit: AuditEntry[] = [];
  let sessionsPaid = 0;
  let hoursMinutes = 0;
  let hourlyPay = 0;
  let perSessionPay = 0;
  let fixedMonthlyPay = 0;
  let automaticPenalties = 0;

  // FIXED_MONTHLY chỉ cộng 1 lần per (teacher × rule). Track theo rule_id.
  const fixedAppliedFor = new Set<string>();

  for (const unit of paid_units) {
    if (unit.pay_share_pct <= 0) continue;

    const rate = unit.resolved_rate;
    const share = unit.pay_share_pct / 100;
    const minutes = unit.actual_minutes;

    sessionsPaid += 1;
    hoursMinutes += Math.round(minutes * share);

    // HOURLY component
    if (
      rate.payment_structure === "HOURLY" ||
      rate.payment_structure === "HYBRID"
    ) {
      const gross = Math.floor(
        (minutes * rate.hourly_rate * share) / MINUTES_PER_HOUR,
      );
      hourlyPay += gross;
      audit.push({
        kind: share < 1 ? "CO_TEACHER_SPLIT" : "SESSION_PAY",
        session_id: unit.session_id,
        amount: gross,
        reason:
          share < 1
            ? `Co-teach ${unit.pay_share_pct}% — ${minutes} phút × ${rate.hourly_rate}/h`
            : `${minutes} phút × ${rate.hourly_rate}/h (rule: ${rate.rule_scope})`,
      });
    }

    // PER_SESSION component
    if (
      (rate.payment_structure === "PER_SESSION" ||
        rate.payment_structure === "HYBRID") &&
      rate.per_session_rate !== null
    ) {
      const gross = Math.floor(rate.per_session_rate * share);
      perSessionPay += gross;
      audit.push({
        kind: share < 1 ? "CO_TEACHER_SPLIT" : "SESSION_PAY",
        session_id: unit.session_id,
        amount: gross,
        reason:
          share < 1
            ? `Co-teach ${unit.pay_share_pct}% — 1 buổi × ${rate.per_session_rate}`
            : `1 buổi × ${rate.per_session_rate} (rule: ${rate.rule_scope})`,
      });
    }

    // FIXED_MONTHLY — không chia theo share, chỉ cộng 1 lần per rule.
    if (
      (rate.payment_structure === "FIXED_MONTHLY" ||
        rate.payment_structure === "HYBRID") &&
      rate.fixed_monthly_amount !== null &&
      rate.rule_id !== null &&
      !fixedAppliedFor.has(rate.rule_id)
    ) {
      fixedAppliedFor.add(rate.rule_id);
      fixedMonthlyPay += rate.fixed_monthly_amount;
      audit.push({
        kind: "FIXED_MONTHLY_PAY",
        amount: rate.fixed_monthly_amount,
        reason: `Lương tháng cố định (rule: ${rate.rule_scope}) — không chia theo co-teach`,
      });
    }
  }

  // Adjustments (cùng tầng như path cũ)
  const bonuses = adjustments
    .filter((a) => a.type === "BONUS")
    .reduce((sum, a) => {
      audit.push({
        kind: "BONUS",
        amount: a.amount,
        reason: a.reason,
      });
      return sum + a.amount;
    }, 0);
  const deductions = adjustments
    .filter((a) => a.type === "DEDUCTION")
    .reduce((sum, a) => {
      audit.push({
        kind: "DEDUCTION",
        amount: -a.amount,
        reason: a.reason,
      });
      return sum + a.amount;
    }, 0);

  const grossPay = hourlyPay + perSessionPay + fixedMonthlyPay;
  const calculatedAmount = grossPay - automaticPenalties;
  let finalAmount = calculatedAmount + bonuses - deductions;
  if (finalAmount < 0) {
    audit.push({
      kind: "NEGATIVE_CLAMP",
      amount: -finalAmount,
      reason: `Số tiền âm (${finalAmount}đ) → kẹp về 0`,
    });
    finalAmount = 0;
  }

  return {
    teacher_id,
    period,
    breakdown: {
      hours_taught_minutes: hoursMinutes,
      sessions_paid: sessionsPaid,
      hourly_pay: hourlyPay,
      per_session_pay: perSessionPay,
      fixed_monthly_pay: fixedMonthlyPay,
      bonuses,
      deductions,
      automatic_penalties: automaticPenalties,
      calculated_amount: calculatedAmount,
      paid_units_snapshot: paid_units,
    },
    final_amount: finalAmount,
    audit_trail: audit,
  };
}
