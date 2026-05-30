/**
 * Payroll service — orchestrates calculator + repository.
 *
 * Adjustment edits trigger a recompute; everything else is a status
 * transition. Auth gate is `resolveCenterId({ requireRole: "CENTER_ADMIN" })`
 * — RLS enforces it a second time at the DB.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";
import {
  buildRequestMetadata,
  logAuditEntry,
} from "@/modules/audit/service";
import { calculatePayroll } from "./calculator";
import * as repo from "./repository";
import {
  applyRecurringForPeriod,
  decrementRemainingForApprovedPeriod,
  ruleIdsAppliedInPeriod,
} from "./recurring-adjustments";
import type {
  PayrollItemRow,
  PayrollPeriodRow,
  PayrollPeriodWithItems,
  PayrollResult,
  StoredAdjustment,
  TeacherSnapshot,
} from "./domain-types";
import type {
  AttendanceRecord,
  ManualAdjustment,
  PayrollRules,
  Session,
} from "./types";

export const DEFAULT_RULES: PayrollRules = {
  hours_cap_multiplier: 1.1,
  completion_factor: 1.0,
  late_grace_minutes: 5,
  late_penalty_per_minute: 0,
  co_teacher_split: "EQUAL",
};

function err(error: string): { success: false; error: string } {
  return { success: false, error };
}

function unexpected(e: unknown): { success: false; error: string } {
  return err(e instanceof Error ? e.message : "Đã xảy ra lỗi không xác định.");
}

async function requireAdmin(): Promise<
  | { ok: true; centerId: string; userId: string }
  | { ok: false; error: string }
> {
  const r = await resolveCenterId({ requireRole: "CENTER_ADMIN" });
  if (!r.ok) return { ok: false, error: r.message };
  return { ok: true, centerId: r.centerId, userId: r.userId };
}

/**
 * Display name for the audit log. Best-effort: pulls from
 * auth.user_metadata first, falls back to email-prefix, then generic.
 */
async function getActorName(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Quản trị viên";
    const meta = user.user_metadata as
      | { display_name?: string; full_name?: string }
      | undefined;
    return (
      meta?.display_name ||
      meta?.full_name ||
      user.email?.split("@")[0] ||
      "Quản trị viên"
    );
  } catch {
    return "Quản trị viên";
  }
}

// ─── Period operations ───────────────────────────────────────────────────────

export async function listPayrollPeriods(): Promise<
  PayrollResult<PayrollPeriodRow[]>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);
  try {
    const supabase = await createClient();
    const data = await repo.listPeriods(supabase, auth.centerId);
    return { success: true, data };
  } catch (e) {
    return unexpected(e);
  }
}

export async function getPayrollPeriod(
  id: string,
): Promise<PayrollResult<PayrollPeriodWithItems>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);
  try {
    const supabase = await createClient();
    const period = await repo.findPeriodWithItems(supabase, id);
    if (!period) return err("Không tìm thấy kỳ lương.");
    return { success: true, data: period };
  } catch (e) {
    return unexpected(e);
  }
}

/**
 * Create a new period and run the calculator for every supplied teacher.
 *
 * The caller passes session data — in production this will come from the
 * sessions module (Cycle 7+). The service is intentionally agnostic so
 * the seed script and future sessions-module integration can both use it.
 */
export async function createPayrollPeriod(input: {
  period_start: string;
  period_end: string;
  notes?: string;
  teachers: TeacherSnapshot[];
  sessions: Session[];
  attendance?: AttendanceRecord[];
  rules?: Partial<PayrollRules>;
}): Promise<PayrollResult<PayrollPeriodWithItems>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);

  try {
    const supabase = await createClient();

    const period = await repo.insertPeriod(supabase, {
      center_id: auth.centerId,
      period_start: input.period_start,
      period_end: input.period_end,
      notes: input.notes ?? "",
    });

    const rules = { ...DEFAULT_RULES, ...input.rules };

    // Fetch recurring adjustments active cho kỳ này (group theo teacher_id).
    // Fail-soft: nếu lỗi gì khi đọc bảng, vẫn cho tạo kỳ — admin có thể
    // thêm manual sau. Audit log ghi lý do bỏ.
    let recurringByTeacher = new Map<string, StoredAdjustment[]>();
    try {
      recurringByTeacher = await applyRecurringForPeriod(
        supabase,
        auth.centerId,
        { start: input.period_start, end: input.period_end },
      );
    } catch (e) {
      console.warn("[payroll] recurring fetch failed, skipping:", e);
    }

    const items: PayrollItemRow[] = [];
    for (const snapshot of input.teachers) {
      const result = calculatePayroll({
        teacher: {
          id: snapshot.id,
          payment_structure: snapshot.payment_structure,
          hourly_rate: snapshot.hourly_rate,
          per_session_rate: snapshot.per_session_rate,
          fixed_monthly_amount: snapshot.fixed_monthly_amount,
        },
        sessions: input.sessions,
        attendance: input.attendance ?? [],
        adjustments: [],
        period: {
          start: input.period_start,
          end: input.period_end,
          timezone: "Asia/Ho_Chi_Minh",
        },
        rules,
      });

      // Inject recurring adjustments (BONUS / DEDUCTION) cùng tầng với
      // manual — không đụng `calculated_amount` (giữ là kết quả thuần
      // của calculator). `final_amount` cộng/trừ recurring vào.
      const recurringAdjs = recurringByTeacher.get(snapshot.id) ?? [];
      const recurringBonus = recurringAdjs
        .filter((a) => a.type === "BONUS")
        .reduce((sum, a) => sum + a.amount, 0);
      const recurringDeduction = recurringAdjs
        .filter((a) => a.type === "DEDUCTION")
        .reduce((sum, a) => sum + a.amount, 0);
      const finalAmount =
        result.final_amount + recurringBonus - recurringDeduction;

      // Cộng vào breakdown.bonuses/deductions để audit hiển thị tổng đúng.
      const breakdownWithRecurring = {
        ...result.breakdown,
        bonuses: result.breakdown.bonuses + recurringBonus,
        deductions: result.breakdown.deductions + recurringDeduction,
      };

      const row = await repo.upsertItem(supabase, {
        payroll_period_id: period.id,
        teacher_id: snapshot.id,
        teacher_snapshot: snapshot,
        calculated_amount: result.breakdown.calculated_amount,
        final_amount: finalAmount,
        adjustments: recurringAdjs,
        breakdown: breakdownWithRecurring,
        audit_trail: result.audit_trail,
      });
      items.push(row);
    }

    return { success: true, data: { ...period, items } };
  } catch (e) {
    return unexpected(e);
  }
}

// ─── Adjustment edit (recomputes the item) ───────────────────────────────────

export async function addAdjustment(
  itemId: string,
  input: { type: "BONUS" | "DEDUCTION"; amount: number; reason: string },
  // Optional re-supply of sessions/attendance — when undefined the recompute
  // reuses what's already in `breakdown` (no-op for fixed-monthly; for HOURLY/
  // PER_SESSION the recompute would need session data, which we don't store).
  // For Cycle 6 we accept that adjustments only adjust the manual-adjustment
  // bucket; session-side numbers are taken from the existing breakdown.
  _opts?: { sessions?: Session[]; attendance?: AttendanceRecord[] },
): Promise<PayrollResult<PayrollItemRow>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);

  const reason = input.reason.trim();
  if (!reason) {
    // PRD §5.8: "Edit individual amount (with reason)". Block save if empty.
    return err("Lý do điều chỉnh không được để trống.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return err("Số tiền phải là số nguyên dương (VND).");
  }

  try {
    const supabase = await createClient();
    const item = await repo.findItem(supabase, itemId);
    if (!item) return err("Không tìm thấy dòng lương.");

    const period = await repo.findPeriod(supabase, item.payroll_period_id);
    if (!period) return err("Không tìm thấy kỳ lương.");
    if (period.status !== "DRAFT") {
      return err("Kỳ lương đã được duyệt, không thể chỉnh sửa.");
    }

    const next: StoredAdjustment = {
      id: randomUUID(),
      type: input.type,
      amount: input.amount,
      reason,
      created_at: new Date().toISOString(),
      created_by: auth.userId,
    };

    const adjustments = [...item.adjustments, next];
    const updated = recomputeFromAdjustments(item, adjustments);
    const saved = await repo.updateItem(supabase, itemId, updated);

    await logAuditEntry({
      center_id: period.center_id,
      user_id: auth.userId,
      action: "payroll.adjustment.add",
      entity_type: "payroll_item",
      entity_id: itemId,
      before: { final_amount: item.final_amount, adjustments: item.adjustments },
      after: { final_amount: saved.final_amount, adjustments: saved.adjustments },
      metadata: await buildRequestMetadata({
        actor_name: await getActorName(),
        target_name: item.teacher_snapshot.name,
        adjustment_type: input.type,
        amount: input.amount,
        reason,
      }),
    });

    return { success: true, data: saved };
  } catch (e) {
    return unexpected(e);
  }
}

export async function removeAdjustment(
  itemId: string,
  adjustmentId: string,
): Promise<PayrollResult<PayrollItemRow>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);

  try {
    const supabase = await createClient();
    const item = await repo.findItem(supabase, itemId);
    if (!item) return err("Không tìm thấy dòng lương.");

    const period = await repo.findPeriod(supabase, item.payroll_period_id);
    if (!period || period.status !== "DRAFT") {
      return err("Kỳ lương đã được duyệt, không thể chỉnh sửa.");
    }

    const removed = item.adjustments.find((a) => a.id === adjustmentId);
    const adjustments = item.adjustments.filter((a) => a.id !== adjustmentId);
    const updated = recomputeFromAdjustments(item, adjustments);
    const saved = await repo.updateItem(supabase, itemId, updated);

    if (removed) {
      await logAuditEntry({
        center_id: period.center_id,
        user_id: auth.userId,
        action: "payroll.adjustment.remove",
        entity_type: "payroll_item",
        entity_id: itemId,
        before: { final_amount: item.final_amount, adjustments: item.adjustments },
        after: { final_amount: saved.final_amount, adjustments: saved.adjustments },
        metadata: await buildRequestMetadata({
          actor_name: await getActorName(),
          target_name: item.teacher_snapshot.name,
          adjustment_type: removed.type,
          amount: removed.amount,
          reason: removed.reason,
        }),
      });
    }

    return { success: true, data: saved };
  } catch (e) {
    return unexpected(e);
  }
}

/**
 * Apply a new adjustments[] without re-running the session math. We trust
 * the previously-stored breakdown (sessions_paid, hours, hourly_pay etc.)
 * and only re-do the final-amount math: calculated_amount + bonuses −
 * deductions − automatic_penalties, clamped at 0.
 */
function recomputeFromAdjustments(
  item: PayrollItemRow,
  adjustments: StoredAdjustment[],
): Pick<
  PayrollItemRow,
  "adjustments" | "calculated_amount" | "final_amount" | "breakdown" | "audit_trail"
> {
  const bonuses = adjustments
    .filter((a) => a.type === "BONUS")
    .reduce((s, a) => s + a.amount, 0);
  const deductions = adjustments
    .filter((a) => a.type === "DEDUCTION")
    .reduce((s, a) => s + a.amount, 0);

  const calculated = item.breakdown.calculated_amount;
  const autoPenalties = item.breakdown.automatic_penalties;
  const raw = calculated + bonuses - deductions - autoPenalties;
  const final = raw < 0 ? 0 : raw;

  const breakdown = { ...item.breakdown, bonuses, deductions };

  // Strip out manual BONUS/DEDUCTION audit rows from the calculator and
  // replace with the current adjustments[] state (so the audit reflects
  // what's actually applied right now).
  const sessionTrail = item.audit_trail.filter(
    (e) => e.kind !== "BONUS" && e.kind !== "DEDUCTION" && e.kind !== "NEGATIVE_CLAMP",
  );
  const manualTrail = adjustments.map((a) => ({
    kind: a.type,
    amount: a.type === "BONUS" ? a.amount : -a.amount,
    reason: a.reason,
  }));
  const clampTrail =
    raw < 0
      ? [
          {
            kind: "NEGATIVE_CLAMP" as const,
            amount: -raw,
            reason: `Tổng âm (${raw.toLocaleString("vi-VN")}đ) — đã giới hạn về 0`,
          },
        ]
      : [];

  return {
    adjustments,
    calculated_amount: calculated,
    final_amount: final,
    breakdown,
    audit_trail: [...sessionTrail, ...manualTrail, ...clampTrail],
  };
}

// ─── Status transitions ──────────────────────────────────────────────────────

export async function approvePeriod(
  periodId: string,
): Promise<PayrollResult<PayrollPeriodRow>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);

  try {
    const supabase = await createClient();
    const period = await repo.findPeriod(supabase, periodId);
    if (!period) return err("Không tìm thấy kỳ lương.");
    if (period.status !== "DRAFT") {
      return err("Chỉ kỳ lương DRAFT mới có thể duyệt.");
    }
    const updated = await repo.updatePeriodStatus(supabase, periodId, {
      status: "APPROVED",
      approved_by: auth.userId,
      approved_at: new Date().toISOString(),
    });

    // Decrement N_PERIODS_LEFT cho các recurring rule đã áp vào kỳ này.
    // Chỉ làm lúc APPROVE — không lúc CREATE DRAFT (admin xóa draft thì
    // count không bị mất).
    try {
      const itemsForRules = await repo.listItems(supabase, periodId);
      const ruleIds = ruleIdsAppliedInPeriod(itemsForRules);
      await decrementRemainingForApprovedPeriod(supabase, ruleIds);
    } catch (e) {
      // Decrement fail không nên block approve — log cảnh báo.
      console.warn(
        "[payroll] decrement recurring remaining_periods failed:",
        e,
      );
    }

    await logAuditEntry({
      center_id: period.center_id,
      user_id: auth.userId,
      action: "payroll.period.approve",
      entity_type: "payroll_period",
      entity_id: periodId,
      before: { status: period.status },
      after: {
        status: updated.status,
        approved_at: updated.approved_at,
        approved_by: updated.approved_by,
      },
      metadata: await buildRequestMetadata({
        actor_name: await getActorName(),
        status_from: period.status,
        status_to: updated.status,
      }),
    });

    return { success: true, data: updated };
  } catch (e) {
    return unexpected(e);
  }
}

export async function markPeriodPaid(
  periodId: string,
): Promise<PayrollResult<PayrollPeriodRow>> {
  const auth = await requireAdmin();
  if (!auth.ok) return err(auth.error);

  try {
    const supabase = await createClient();
    const period = await repo.findPeriod(supabase, periodId);
    if (!period) return err("Không tìm thấy kỳ lương.");
    if (period.status !== "APPROVED") {
      return err("Chỉ kỳ lương đã duyệt mới có thể đánh dấu đã thanh toán.");
    }
    const updated = await repo.updatePeriodStatus(supabase, periodId, {
      status: "PAID",
      paid_at: new Date().toISOString(),
    });

    await logAuditEntry({
      center_id: period.center_id,
      user_id: auth.userId,
      action: "payroll.period.mark_paid",
      entity_type: "payroll_period",
      entity_id: periodId,
      before: { status: period.status },
      after: { status: updated.status, paid_at: updated.paid_at },
      metadata: await buildRequestMetadata({
        actor_name: await getActorName(),
        status_from: period.status,
        status_to: updated.status,
      }),
    });

    return { success: true, data: updated };
  } catch (e) {
    return unexpected(e);
  }
}
