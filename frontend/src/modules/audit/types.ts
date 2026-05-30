/**
 * Audit module — type contracts.
 *
 * The DB schema is intentionally loose (action/entity_type are TEXT) so
 * Cycle 7+ modules can add new keys without migrations. The TypeScript
 * union below is the authoritative whitelist for keys we currently emit.
 */

/** Dotted lowercase action keys. New events go through here first. */
export type AuditAction =
  | "payroll.adjustment.add"
  | "payroll.adjustment.remove"
  | "payroll.period.approve"
  | "payroll.period.mark_paid"
  | "tenant.payroll_engine.change";

/** Coarse entity bucket for the (entity_type, entity_id) index. */
export type AuditEntityType = "payroll_period" | "payroll_item" | "tenant";

/** Strongly-typed metadata blob. Free-form JSONB at the DB; this is the union. */
export interface AuditMetadata {
  /** Why the change was made (REQUIRED for adjustments per PRD §5.8). */
  reason?: string;
  /** Denormalized display name of the actor at log time (resilient to renames). */
  actor_name?: string;
  /** Denormalized name of the affected teacher when applicable. */
  target_name?: string;
  /** For adjustment events. */
  adjustment_type?: "BONUS" | "DEDUCTION";
  /** Integer VND. */
  amount?: number;
  /** For approve / mark_paid — the period status transition. */
  status_from?: string;
  status_to?: string;
  /** Request context. */
  ip?: string;
  user_agent?: string;
}

export interface AuditLogRow {
  id: string;
  center_id: string;
  user_id: string | null;
  action: AuditAction | string; // accepts unknown actions on read for forward compatibility
  entity_type: AuditEntityType | string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: AuditMetadata;
  created_at: string;
}

export interface AuditLogInput {
  center_id: string;
  user_id: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: AuditMetadata;
}

export interface AuditListFilters {
  /** Restrict to a single entity (period or item). */
  entity_type?: AuditEntityType;
  entity_id?: string;
  /** Restrict to a single action key. */
  action?: AuditAction;
  /** Restrict to entries created by a specific user. */
  user_id?: string;
  /** Inclusive bounds in YYYY-MM-DD (center tz). */
  date_from?: string;
  date_to?: string;
  /** Default 100; never exceeds 500 server-side. */
  limit?: number;
}

export type AuditResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
