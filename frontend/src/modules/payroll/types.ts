/**
 * Payroll calculator — public types.
 *
 * The killer feature per PRD §5.8. **All money is integer đồng (VND);
 * never floats** (CLAUDE.md §8.1). Time math is done in integer minutes
 * for the same reason: a 1.5-hour session is 90 minutes, not 1.5.
 *
 * Phase A defines the contract; Phase B fills in calculator.ts.
 */

export type PaymentStructure =
  | "HOURLY"
  | "PER_SESSION"
  | "FIXED_MONTHLY"
  | "HYBRID";

export type SessionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED";

export interface Teacher {
  id: string;
  /** Stable identifier used by `assigned_teacher_id` on sessions. */
  payment_structure: PaymentStructure;
  /** VND/hour, integer. Set for HOURLY + HYBRID; ignored otherwise. */
  hourly_rate: number;
  /** VND/session, integer. Set for PER_SESSION + HYBRID; ignored otherwise. */
  per_session_rate: number | null;
  /** VND/month, integer. Set for FIXED_MONTHLY + HYBRID; ignored otherwise. */
  fixed_monthly_amount: number | null;
}

export interface Session {
  id: string;
  class_id: string;
  /** Local date in the center's timezone. YYYY-MM-DD. */
  date: string;
  /** Local 24h HH:mm. */
  start_time: string;
  end_time: string;
  /** Whichever teacher is on the hook at completion time (substitute-aware). */
  assigned_teacher_id: string;
  status: SessionStatus;
  /** ISO timestamp with offset, or null if not recorded. */
  teacher_checkin_at: string | null;
  teacher_checkout_at: string | null;
  /** Co-teachers (assistants). Empty / omitted = solo session. */
  co_teacher_ids?: string[];
}

/**
 * Student-level attendance. Surfaced here so the calculator can support
 * future "student no-show" signals, but the v1 math doesn't depend on it.
 */
export interface AttendanceRecord {
  session_id: string;
  student_id: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
}

export interface ManualAdjustment {
  type: "BONUS" | "DEDUCTION";
  /** Positive integer VND; sign comes from `type`. */
  amount: number;
  reason: string;
}

export interface Period {
  /** Inclusive YYYY-MM-DD in `timezone`. */
  start: string;
  /** Inclusive YYYY-MM-DD in `timezone`. */
  end: string;
  /** IANA tz name. Default `Asia/Ho_Chi_Minh`. */
  timezone: string;
}

/**
 * Per-center configurable rules (PRD §5.8 mentions every one of these as
 * "configurable"). Defaults live in the payroll service, not here.
 */
export interface PayrollRules {
  /** Hours capped at `scheduled_duration × this`. PRD §5.8 specifies 1.1. */
  hours_cap_multiplier: number;
  /** When no check-in/out is recorded: hours = scheduled × this. */
  completion_factor: number;
  /** Minutes of grace before late-check-in penalty kicks in. */
  late_grace_minutes: number;
  /** VND per minute of lateness past the grace window. 0 disables the penalty. */
  late_penalty_per_minute: number;
  /** Co-teaching split rule. PRD §5.8: "Multi-teacher session: split pay configurable." */
  co_teacher_split: "EQUAL" | "PRIMARY_FULL";
}

export interface PayrollBreakdown {
  /** Total integer minutes the teacher was paid for (HOURLY component only). */
  hours_taught_minutes: number;
  /** Number of COMPLETED sessions that contributed to pay. */
  sessions_paid: number;
  hourly_pay: number;
  per_session_pay: number;
  fixed_monthly_pay: number;
  bonuses: number;
  /** Positive integer: amount subtracted, not the signed value. */
  deductions: number;
  /** Auto-applied penalties (late check-in, etc.). Positive integer. */
  automatic_penalties: number;
  /** Pre-adjustment, pre-clamp gross. */
  calculated_amount: number;
}

export type AuditEntryKind =
  | "SESSION_PAY"
  | "SESSION_SKIPPED"
  | "SUBSTITUTE_PAY"
  | "CO_TEACHER_SPLIT"
  | "HOURS_CAPPED"
  | "LATE_PENALTY"
  | "BONUS"
  | "DEDUCTION"
  | "NEGATIVE_CLAMP"
  | "FIXED_MONTHLY_PAY";

export interface AuditEntry {
  kind: AuditEntryKind;
  session_id?: string;
  /** Signed VND. Negative for deductions/penalties/clamps. */
  amount: number;
  reason: string;
}

export interface PayrollResult {
  teacher_id: string;
  period: Period;
  breakdown: PayrollBreakdown;
  /** Final clamped amount. Never negative. */
  final_amount: number;
  /** Ordered audit trail for the breakdown UI + Excel export. */
  audit_trail: AuditEntry[];
}

export interface PayrollInput {
  teacher: Teacher;
  /** ALL sessions in the period; calculator filters by assigned_teacher_id + status. */
  sessions: Session[];
  attendance: AttendanceRecord[];
  adjustments: ManualAdjustment[];
  period: Period;
  rules: PayrollRules;
}
