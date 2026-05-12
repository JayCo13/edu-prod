/**
 * Payroll domain types — the persisted shapes.
 *
 * Distinct from `types.ts` (which defines the pure-function calculator
 * contract). Domain types include DB-side concerns: period status,
 * snapshots, adjustment-row identity, timestamps.
 */

import type {
  AuditEntry,
  ManualAdjustment,
  PayrollBreakdown,
  PaymentStructure,
} from "./types";

export type PayrollPeriodStatus = "DRAFT" | "APPROVED" | "PAID";

export interface PayrollPeriodRow {
  id: string;
  center_id: string;
  /** YYYY-MM-DD (inclusive). */
  period_start: string;
  period_end: string;
  status: PayrollPeriodStatus;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * Snapshot of the teacher at the time the period was created. Frozen so
 * payroll history stays correct when a teacher later changes their rate.
 */
export interface TeacherSnapshot {
  id: string;
  name: string;
  /** Optional Vietnamese tax ID (Mã số thuế). Excel uses it; empty = "-". */
  mst: string | null;
  payment_structure: PaymentStructure;
  hourly_rate: number;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
}

/** Stored adjustment carries identity + provenance, unlike the calculator's plain ManualAdjustment. */
export interface StoredAdjustment {
  id: string;
  type: ManualAdjustment["type"];
  amount: number;
  reason: string;
  created_at: string;
  created_by: string | null;
}

export interface PayrollItemRow {
  id: string;
  payroll_period_id: string;
  teacher_id: string;
  teacher_snapshot: TeacherSnapshot;
  calculated_amount: number;
  final_amount: number;
  adjustments: StoredAdjustment[];
  breakdown: PayrollBreakdown;
  audit_trail: AuditEntry[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Joined shape returned by the period-detail page. */
export interface PayrollPeriodWithItems extends PayrollPeriodRow {
  items: PayrollItemRow[];
}

/** Uniform envelope mirroring the centers module. */
export type PayrollResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
