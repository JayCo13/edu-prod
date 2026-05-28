/**
 * Payroll Server Actions — UI invocation surface.
 *
 * Reads are direct service calls (no extra wrapper); mutations
 * revalidate the affected paths so the page reflects the new state on
 * next render.
 *
 * Excel export is a *route handler* (binary download — Server Actions
 * are awkward for files); see app/api/v1/payroll-periods/[id]/export.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import {
  payoutPaidEmailContent,
  sendWhiteLabelEmail,
} from "@/lib/email/sender";
import { calculatePayroll } from "./calculator";
import {
  addAdjustment,
  approvePeriod,
  createPayrollPeriod,
  DEFAULT_RULES,
  getPayrollPeriod,
  listPayrollPeriods,
  markPeriodPaid,
  removeAdjustment,
} from "./service";
import * as repo from "./repository";
import type { Session, SessionStatus } from "./types";
import type { StoredAdjustment, TeacherSnapshot } from "./domain-types";
import type { PayrollItemPaymentMethod } from "@/types/database";

const LIST_PATH = "/admin/payroll";
const periodPath = (id: string) => `/admin/payroll/${id}`;

export async function listPayrollPeriodsAction() {
  return listPayrollPeriods();
}

export async function getPayrollPeriodAction(id: string) {
  return getPayrollPeriod(id);
}

// ── Payout schedule (recurring monthly) ──────────────────────────────────

const VN_TZ_OFFSET_HOURS = 7; // Asia/Ho_Chi_Minh, no DST.

/** Vietnam-local "today" expressed as YYYY-MM-DD. Used to make the "is the
 *  payout day reached?" check stable regardless of the server's clock. */
function vnToday(): { year: number; month: number; day: number } {
  const now = new Date(Date.now() + VN_TZ_OFFSET_HOURS * 3_600_000);
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1, // 1-12
    day: now.getUTCDate(),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function lastDayOf(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/** {start, end} as YYYY-MM-DD for the calendar month that ended most
 *  recently before (or at) the given anchor month. */
function previousMonthBounds(anchor: { year: number; month: number }): {
  start: string;
  end: string;
  year: number;
  month: number;
} {
  let y = anchor.year;
  let m = anchor.month - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  const last = lastDayOf(y, m);
  return {
    year: y,
    month: m,
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(last)}`,
  };
}

export interface PayoutScheduleSummary {
  payout_day: number | null;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh: the next payout date from today (or today). */
  next_payout_date: string | null;
  /** Whether the period for the previous calendar month already exists. */
  previous_month_period_exists: boolean;
  /** Whether today is on/after this month's payout day (so an auto-gen is due). */
  due_now: boolean;
}

export async function getPayoutScheduleAction(): Promise<
  | { success: true; data: PayoutScheduleSummary }
  | { success: false; error: string }
> {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx)
    return { success: false, error: "Phiên đăng nhập đã hết hạn." };

  const supabase = await createClient();
  const { data: center, error } = await supabase
    .from("centers")
    .select("payroll_payout_day")
    .eq("id", ctx.tenant.id)
    .maybeSingle();
  if (error) return { success: false, error: error.message };

  const day = (center?.payroll_payout_day as number | null) ?? null;
  const today = vnToday();
  const prev = previousMonthBounds(today);

  // Does the previous-month period already exist?
  const { count } = await supabase
    .from("payroll_periods")
    .select("id", { count: "exact", head: true })
    .eq("center_id", ctx.tenant.id)
    .eq("period_start", prev.start)
    .eq("period_end", prev.end);
  const previousMonthPeriodExists = (count ?? 0) > 0;

  let next: string | null = null;
  let dueNow = false;
  if (day != null) {
    // If today < day-of-month, next payout is THIS month's day. Else next month's.
    // Clamp to month-length so day=31 in Feb maps to Feb 28/29.
    const todayLast = lastDayOf(today.year, today.month);
    const todayDay = Math.min(day, todayLast);
    if (today.day < todayDay) {
      next = `${today.year}-${pad2(today.month)}-${pad2(todayDay)}`;
      dueNow = false;
    } else {
      let ny = today.year;
      let nm = today.month + 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
      const nextLast = lastDayOf(ny, nm);
      const nextDay = Math.min(day, nextLast);
      next = `${ny}-${pad2(nm)}-${pad2(nextDay)}`;
      // "Due" = today is on/after this month's payout day, and we haven't
      // generated last month's period yet.
      dueNow = !previousMonthPeriodExists;
    }
  }

  return {
    success: true,
    data: {
      payout_day: day,
      next_payout_date: next,
      previous_month_period_exists: previousMonthPeriodExists,
      due_now: dueNow,
    },
  };
}

export async function setPayoutScheduleAction(input: {
  /** 1-31, or null to clear the schedule. */
  payout_day: number | null;
}) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx)
    return { success: false as const, error: "Phiên đăng nhập đã hết hạn." };
  if (!ctx.isAdmin) {
    return {
      success: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể cấu hình lịch trả lương.",
    };
  }
  const day = input.payout_day;
  if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
    return { success: false as const, error: "Ngày trả lương phải trong khoảng 1–31." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("centers")
    .update({ payroll_payout_day: day })
    .eq("id", ctx.tenant.id);
  if (error) return { success: false as const, error: error.message };

  revalidatePath(LIST_PATH);
  return { success: true as const, data: { payout_day: day } };
}

/**
 * Lazy auto-generation: if today (VN) is on/after the configured payout
 * day AND the previous-month period doesn't already exist, create it via
 * the existing tenant auto-populate. Idempotent — safe to call on every
 * /admin/payroll render. Returns the created period id when it actually
 * generates one, otherwise null.
 */
export async function ensurePreviousMonthPeriodAction(): Promise<
  | { success: true; data: { generated: boolean; periodId: string | null } }
  | { success: false; error: string }
> {
  const schedule = await getPayoutScheduleAction();
  if (!schedule.success) return schedule;
  if (!schedule.data.due_now) {
    return { success: true, data: { generated: false, periodId: null } };
  }

  const today = vnToday();
  const prev = previousMonthBounds(today);
  const created = await createPayrollPeriodFromTenantAction({
    period_start: prev.start,
    period_end: prev.end,
    notes: `Tự động tạo vào ngày trả lương (${pad2(today.day)}/${pad2(today.month)}/${today.year}).`,
  });
  if (!created.success) return { success: false, error: created.error };
  revalidatePath(LIST_PATH);
  return {
    success: true,
    data: { generated: true, periodId: created.data.id },
  };
}

/**
 * Creates an empty DRAFT period — escape hatch only. Used when a seed
 * script will populate items separately. Prefer the auto-populate flow.
 */
export async function createEmptyPayrollPeriodAction(input: {
  period_start: string;
  period_end: string;
  notes?: string;
}) {
  const r = await createPayrollPeriod({
    period_start: input.period_start,
    period_end: input.period_end,
    notes: input.notes,
    teachers: [],
    sessions: [],
  });
  if (r.success) revalidatePath(LIST_PATH);
  return r;
}

/**
 * Creates a DRAFT period and auto-populates items from the caller's current
 * tenant: every active teacher in `tenant_teachers`, with their pay computed
 * from `live_sessions` that fall in [period_start, period_end].
 *
 * This is what the /admin/payroll "Tạo kỳ lương mới" modal calls — the
 * empty version above stays as a debug escape hatch.
 *
 * Session → calculator mapping:
 *   - `class_id`         → `live_sessions.course_id` (or "standalone" when NULL)
 *   - `date`             → start_time projected to Asia/Ho_Chi_Minh (YYYY-MM-DD)
 *   - `start_time` /
 *     `end_time`         → HH:mm derived from start_time + duration_minutes
 *   - `assigned_teacher_id` → `live_sessions.teacher_id`
 *   - `status`           → CANCELLED if is_cancelled, else COMPLETED if start_time
 *                          is in the past, else SCHEDULED. Calculator pays only
 *                          COMPLETED. (Check-in / check-out aren't recorded yet,
 *                          so we fall back to scheduled duration via completion_factor.)
 */
export async function createPayrollPeriodFromTenantAction(input: {
  period_start: string; // YYYY-MM-DD inclusive
  period_end: string; // YYYY-MM-DD inclusive
  notes?: string;
}) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) return { success: false as const, error: "Phiên đăng nhập đã hết hạn." };
  if (!ctx.isAdmin) {
    return {
      success: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể tạo kỳ lương.",
    };
  }
  const supabase = await createClient();

  // 1. Active teachers + rates.
  const { data: teacherRows, error: tErr } = await supabase
    .from("tenant_teachers")
    .select(
      "id, display_name, payment_structure, hourly_rate, per_session_rate, fixed_monthly_amount, tax_id",
    )
    .eq("tenant_id", ctx.tenant.id)
    .eq("is_active", true);
  if (tErr) return { success: false as const, error: tErr.message };

  const teachers: TeacherSnapshot[] = (teacherRows ?? []).map((t) => ({
    id: t.id,
    name: t.display_name,
    mst: t.tax_id,
    payment_structure: t.payment_structure,
    hourly_rate: t.hourly_rate ?? 0,
    per_session_rate: t.per_session_rate,
    fixed_monthly_amount: t.fixed_monthly_amount,
  }));

  // 2. Sessions in the period (inclusive). Convert local YYYY-MM-DD to a
  //    UTC window using the Vietnam offset (+07, no DST) — fine for v1.
  const startIso = `${input.period_start}T00:00:00+07:00`;
  const endIso = `${input.period_end}T23:59:59.999+07:00`;
  const { data: sessionRows, error: sErr } = await supabase
    .from("live_sessions")
    .select("id, course_id, teacher_id, start_time, duration_minutes, is_cancelled")
    .eq("tenant_id", ctx.tenant.id)
    .gte("start_time", new Date(startIso).toISOString())
    .lte("start_time", new Date(endIso).toISOString());
  if (sErr) return { success: false as const, error: sErr.message };

  const now = Date.now();
  const sessions: Session[] = (sessionRows ?? []).map((s) => {
    const start = new Date(s.start_time);
    // Project to Asia/Ho_Chi_Minh by adding +07 then reading UTC parts.
    const vnStart = new Date(start.getTime() + 7 * 3_600_000);
    const vnEnd = new Date(vnStart.getTime() + (s.duration_minutes ?? 0) * 60_000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const date = `${vnStart.getUTCFullYear()}-${pad(vnStart.getUTCMonth() + 1)}-${pad(vnStart.getUTCDate())}`;
    const start_time = `${pad(vnStart.getUTCHours())}:${pad(vnStart.getUTCMinutes())}`;
    const end_time = `${pad(vnEnd.getUTCHours())}:${pad(vnEnd.getUTCMinutes())}`;
    const status: SessionStatus = s.is_cancelled
      ? "CANCELLED"
      : start.getTime() < now
        ? "COMPLETED"
        : "SCHEDULED";
    return {
      id: s.id,
      class_id: s.course_id ?? "standalone",
      date,
      start_time,
      end_time,
      assigned_teacher_id: s.teacher_id ?? "",
      status,
      teacher_checkin_at: null,
      teacher_checkout_at: null,
    };
  });

  const r = await createPayrollPeriod({
    period_start: input.period_start,
    period_end: input.period_end,
    notes: input.notes,
    teachers,
    sessions,
  });
  if (r.success) revalidatePath(LIST_PATH);
  return r;
}

export async function addAdjustmentAction(
  itemId: string,
  periodId: string,
  input: { type: "BONUS" | "DEDUCTION"; amount: number; reason: string },
) {
  const r = await addAdjustment(itemId, input);
  if (r.success) revalidatePath(periodPath(periodId));
  return r;
}

export async function removeAdjustmentAction(
  itemId: string,
  periodId: string,
  adjustmentId: string,
) {
  const r = await removeAdjustment(itemId, adjustmentId);
  if (r.success) revalidatePath(periodPath(periodId));
  return r;
}

export async function approvePayrollAction(periodId: string) {
  const r = await approvePeriod(periodId);
  if (r.success) {
    revalidatePath(periodPath(periodId));
    revalidatePath(LIST_PATH);
  }
  return r;
}

export async function markPayrollPaidAction(periodId: string) {
  const r = await markPeriodPaid(periodId);
  if (r.success) {
    revalidatePath(periodPath(periodId));
    revalidatePath(LIST_PATH);
  }
  return r;
}

/**
 * Recalculate a DRAFT period in place against the latest tenant data.
 *
 * Why this exists: payroll_items.teacher_snapshot is intentionally frozen
 * at create-period time so an APPROVED/PAID period can't be silently
 * rewritten by a later rate edit (PRD §11). But while the period is still
 * DRAFT, the admin may have just fixed a teacher's pay config — the
 * snapshot is now stale and needs to refresh.
 *
 * Behavior:
 *   - Admin-only, DRAFT-only.
 *   - Re-fetches active tenant_teachers + live_sessions for the period.
 *   - Preserves each existing item's manual adjustments (by teacher_id).
 *   - Upserts items for the current roster (replaces stale snapshots).
 *   - Items for teachers no longer in the active roster are kept (so
 *     manually-added adjustments don't vanish without warning); admin
 *     can delete via the UI later.
 */
export async function recalculatePayrollPeriodAction(periodId: string) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx)
    return { success: false as const, error: "Phiên đăng nhập đã hết hạn." };
  if (!ctx.isAdmin) {
    return {
      success: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể tính lại bảng lương.",
    };
  }

  const supabase = await createClient();
  const period = await repo.findPeriodWithItems(supabase, periodId);
  if (!period) {
    return { success: false as const, error: "Không tìm thấy kỳ lương." };
  }
  if (period.status !== "DRAFT") {
    return {
      success: false as const,
      error: "Kỳ lương đã được duyệt — không thể tính lại.",
    };
  }

  // Snapshot existing adjustments by teacher_id so we don't lose them
  // when we upsert. (calculator → upsertItem replaces breakdown + audit
  // trail; without this, BONUS/DEDUCTION rows the admin added would be
  // wiped.)
  const adjustmentsByTeacher = new Map<string, StoredAdjustment[]>();
  for (const item of period.items) {
    if (item.adjustments.length > 0) {
      adjustmentsByTeacher.set(item.teacher_id, item.adjustments);
    }
  }

  // Pull current teachers + sessions — same shape as the auto-populate
  // path. Duplicated rather than extracted because the period bounds come
  // from the existing row, not user input.
  const { data: teacherRows, error: tErr } = await supabase
    .from("tenant_teachers")
    .select(
      "id, display_name, payment_structure, hourly_rate, per_session_rate, fixed_monthly_amount, tax_id",
    )
    .eq("tenant_id", ctx.tenant.id)
    .eq("is_active", true);
  if (tErr) return { success: false as const, error: tErr.message };

  const teachers: TeacherSnapshot[] = (teacherRows ?? []).map((t) => ({
    id: t.id,
    name: t.display_name,
    mst: t.tax_id,
    payment_structure: t.payment_structure,
    hourly_rate: t.hourly_rate ?? 0,
    per_session_rate: t.per_session_rate,
    fixed_monthly_amount: t.fixed_monthly_amount,
  }));

  const startIso = `${period.period_start}T00:00:00+07:00`;
  const endIso = `${period.period_end}T23:59:59.999+07:00`;
  const { data: sessionRows, error: sErr } = await supabase
    .from("live_sessions")
    .select("id, course_id, teacher_id, start_time, duration_minutes, is_cancelled")
    .eq("tenant_id", ctx.tenant.id)
    .gte("start_time", new Date(startIso).toISOString())
    .lte("start_time", new Date(endIso).toISOString());
  if (sErr) return { success: false as const, error: sErr.message };

  const now = Date.now();
  const sessions: Session[] = (sessionRows ?? []).map((s) => {
    const start = new Date(s.start_time);
    const vnStart = new Date(start.getTime() + 7 * 3_600_000);
    const vnEnd = new Date(vnStart.getTime() + (s.duration_minutes ?? 0) * 60_000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const status: SessionStatus = s.is_cancelled
      ? "CANCELLED"
      : start.getTime() < now
        ? "COMPLETED"
        : "SCHEDULED";
    return {
      id: s.id,
      class_id: s.course_id ?? "standalone",
      date: `${vnStart.getUTCFullYear()}-${pad(vnStart.getUTCMonth() + 1)}-${pad(vnStart.getUTCDate())}`,
      start_time: `${pad(vnStart.getUTCHours())}:${pad(vnStart.getUTCMinutes())}`,
      end_time: `${pad(vnEnd.getUTCHours())}:${pad(vnEnd.getUTCMinutes())}`,
      assigned_teacher_id: s.teacher_id ?? "",
      status,
      teacher_checkin_at: null,
      teacher_checkout_at: null,
    };
  });

  // Recompute + upsert per teacher, layering preserved adjustments back on.
  for (const snapshot of teachers) {
    const result = calculatePayroll({
      teacher: {
        id: snapshot.id,
        payment_structure: snapshot.payment_structure,
        hourly_rate: snapshot.hourly_rate,
        per_session_rate: snapshot.per_session_rate,
        fixed_monthly_amount: snapshot.fixed_monthly_amount,
      },
      sessions,
      attendance: [],
      adjustments: [], // applied below via the stored layer
      period: {
        start: period.period_start,
        end: period.period_end,
        timezone: "Asia/Ho_Chi_Minh",
      },
      rules: DEFAULT_RULES,
    });

    const preserved = adjustmentsByTeacher.get(snapshot.id) ?? [];
    const bonuses = preserved
      .filter((a) => a.type === "BONUS")
      .reduce((s, a) => s + a.amount, 0);
    const deductions = preserved
      .filter((a) => a.type === "DEDUCTION")
      .reduce((s, a) => s + a.amount, 0);
    const raw =
      result.breakdown.calculated_amount +
      bonuses -
      deductions -
      result.breakdown.automatic_penalties;
    const finalAmount = raw < 0 ? 0 : raw;

    await repo.upsertItem(supabase, {
      payroll_period_id: period.id,
      teacher_id: snapshot.id,
      teacher_snapshot: snapshot,
      calculated_amount: result.breakdown.calculated_amount,
      final_amount: finalAmount,
      adjustments: preserved,
      breakdown: { ...result.breakdown, bonuses, deductions },
      audit_trail: result.audit_trail,
    });
  }

  revalidatePath(periodPath(periodId));
  return { success: true as const, data: { periodId } };
}

// ── Per-item payout ──────────────────────────────────────────────────────
//
// Admin marks each teacher's payroll item paid individually (or all at
// once). The period must already be APPROVED — we don't let admins pay
// straight out of DRAFT, the duyệt-trước-khi-chi gate stays.
//
// After all items in a period are paid, the period itself flips to PAID
// so the existing list/excel surfaces continue to work.

/** Look up the auth.users email for a teacher slot id, plus their primary
 *  payout method (so the email can reference the masked account). Uses
 *  the admin client to bypass any RLS asymmetries — the caller has been
 *  gated by `isAdmin` already, so this is fine. */
async function loadPayoutEmailContext(args: {
  teacherId: string;
  tenantId: string;
}): Promise<{
  email: string | null;
  displayName: string;
  bankName: string | null;
  accountTail: string | null;
}> {
  const admin = createAdminClient();
  const { data: slot } = await admin
    .from("tenant_teachers")
    .select("display_name, email, profile_id")
    .eq("id", args.teacherId)
    .maybeSingle();

  // Prefer the auth.users email (canonical), fall back to tenant_teachers.email.
  let email = slot?.email ?? null;
  if (slot?.profile_id) {
    const { data: user } = await admin.auth.admin.getUserById(slot.profile_id);
    if (user?.user?.email) email = user.user.email;
  }

  const { data: method } = await admin
    .from("teacher_payout_methods")
    .select("bank_name, account_number")
    .eq("tenant_id", args.tenantId)
    .eq("teacher_id", args.teacherId)
    .eq("is_primary", true)
    .eq("is_active", true)
    .maybeSingle();

  const account = method?.account_number ?? "";
  const accountTail = account.replace(/\D/g, "").slice(-4) || null;

  return {
    email,
    displayName: slot?.display_name ?? "Quý giáo viên",
    bankName: method?.bank_name ?? null,
    accountTail,
  };
}

function formatPeriodLabel(periodStart: string): string {
  // periodStart is YYYY-MM-DD. Return "Tháng MM/YYYY" for the email.
  const [y, m] = periodStart.split("-");
  return `Tháng ${m}/${y}`;
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

/** If every item in the period has paid_at set, flip period.status to PAID
 *  (one source of truth for the list view). No-op when items remain unpaid. */
async function maybeFlipPeriodToPaid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
  userId: string,
): Promise<void> {
  const { count: unpaid } = await supabase
    .from("payroll_items")
    .select("id", { count: "exact", head: true })
    .eq("payroll_period_id", periodId)
    .is("paid_at", null);
  if ((unpaid ?? 0) > 0) return;
  // The existing markPeriodPaid service does state-machine + audit logging.
  await markPeriodPaid(periodId).catch(() => null);
  void userId; // reserved for future audit attribution
}

interface MarkItemInput {
  itemId: string;
  periodId: string;
  method: PayrollItemPaymentMethod;
  note?: string;
}

export async function markPayrollItemPaidAction(input: MarkItemInput) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx)
    return { success: false as const, error: "Phiên đăng nhập đã hết hạn." };
  if (!ctx.isAdmin) {
    return {
      success: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể đánh dấu đã thanh toán.",
    };
  }
  if (input.method !== "BANK_TRANSFER" && input.method !== "CASH") {
    return { success: false as const, error: "Hình thức thanh toán không hợp lệ." };
  }

  const supabase = await createClient();
  const period = await repo.findPeriod(supabase, input.periodId);
  if (!period) {
    return { success: false as const, error: "Không tìm thấy kỳ lương." };
  }
  if (period.status !== "APPROVED" && period.status !== "PAID") {
    return {
      success: false as const,
      error: "Chỉ có thể thanh toán sau khi kỳ lương đã được duyệt.",
    };
  }

  const item = await repo.findItem(supabase, input.itemId);
  if (!item) return { success: false as const, error: "Không tìm thấy dòng lương." };
  if (item.paid_at) {
    return {
      success: false as const,
      error: "Dòng này đã được đánh dấu là đã thanh toán trước đó.",
    };
  }

  const now = new Date().toISOString();
  // .select().single() so Supabase tells us if RLS blocked the UPDATE.
  // Without it, an RLS-rejected update returns success with zero rows —
  // the email would fire even though nothing was persisted (issue spotted
  // when migration 0014's DRAFT-only UPDATE policy silently refused our
  // mark-paid writes against APPROVED periods).
  const { data: updated, error } = await supabase
    .from("payroll_items")
    .update({
      paid_at: now,
      paid_by: ctx.userId,
      payment_method: input.method,
      paid_note: input.note?.trim() ?? "",
    })
    .eq("id", input.itemId)
    .eq("payroll_period_id", input.periodId)
    .select("id")
    .maybeSingle();
  if (error) return { success: false as const, error: error.message };
  if (!updated) {
    return {
      success: false as const,
      error:
        "Không cập nhật được dòng lương. Vui lòng tải lại trang và thử lại — nếu vẫn lỗi, đảm bảo đã áp dụng migration 0027 trên Supabase.",
    };
  }

  // Fire email — best-effort, don't block the success return.
  void (async () => {
    const ctxInfo = await loadPayoutEmailContext({
      teacherId: item.teacher_id,
      tenantId: period.center_id,
    });
    if (!ctxInfo.email) return;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
      "https://app.vlearning.vn";
    await sendWhiteLabelEmail({
      to: ctxInfo.email,
      subject: `Đã thanh toán lương ${formatPeriodLabel(period.period_start)} — ${item.teacher_snapshot.name}`,
      tenantName: ctx.tenant.name,
      tenantLogo: ctx.tenant.logo_url ?? null,
      htmlContent: payoutPaidEmailContent({
        displayName: ctxInfo.displayName,
        tenantName: ctx.tenant.name,
        periodLabel: formatPeriodLabel(period.period_start),
        amountFormatted: formatVnd(item.final_amount),
        method: input.method,
        accountTail: ctxInfo.accountTail,
        bankName: ctxInfo.bankName,
        adminNote: input.note ?? null,
        dashboardUrl: `${origin}/dashboard`,
      }),
    }).catch(() => null);
  })();

  await maybeFlipPeriodToPaid(supabase, input.periodId, ctx.userId);

  revalidatePath(periodPath(input.periodId));
  revalidatePath(LIST_PATH);
  return { success: true as const, data: { itemId: input.itemId, paidAt: now } };
}

interface MarkAllInput {
  periodId: string;
  method: PayrollItemPaymentMethod;
  note?: string;
}

export async function markAllPayrollItemsPaidAction(input: MarkAllInput) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx)
    return { success: false as const, error: "Phiên đăng nhập đã hết hạn." };
  if (!ctx.isAdmin) {
    return {
      success: false as const,
      error: "Chỉ quản trị viên trung tâm mới có thể đánh dấu đã thanh toán.",
    };
  }

  const supabase = await createClient();
  const period = await repo.findPeriodWithItems(supabase, input.periodId);
  if (!period) {
    return { success: false as const, error: "Không tìm thấy kỳ lương." };
  }
  if (period.status !== "APPROVED" && period.status !== "PAID") {
    return {
      success: false as const,
      error: "Chỉ có thể thanh toán sau khi kỳ lương đã được duyệt.",
    };
  }

  let marked = 0;
  for (const item of period.items) {
    if (item.paid_at) continue;
    const r = await markPayrollItemPaidAction({
      itemId: item.id,
      periodId: input.periodId,
      method: input.method,
      note: input.note,
    });
    if (r.success) marked += 1;
  }

  revalidatePath(periodPath(input.periodId));
  revalidatePath(LIST_PATH);
  return { success: true as const, data: { marked } };
}
