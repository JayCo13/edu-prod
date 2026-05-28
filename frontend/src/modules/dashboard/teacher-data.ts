/**
 * Data feed for TeacherDashboard.
 *
 * Server-only helper that pulls today / this-week / this-month data for
 * the currently signed-in teacher. Uses the user-scoped supabase client so
 * RLS still scopes results — same auth context as everywhere else.
 *
 * Numbers shown are *projections* (no co-teacher splits, no late penalty
 * yet), good enough for a dashboard glance. The authoritative figure
 * remains the payroll period the admin opens at month end.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { TeacherPaymentStructure } from "@/types/database";

interface DashboardSession {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  is_cancelled: boolean;
  course_title: string | null;
}

export interface TeacherDashboardData {
  /** Today, ordered by start_time ascending. Cancelled sessions kept (shown
   *  with a "Đã huỷ" badge). */
  todaySessions: DashboardSession[];
  /** Mon..Sun of the current week. */
  weekStats: {
    completed: number;
    minutes: number;
    upcoming: number;
  };
  /** Current calendar month. */
  monthStats: {
    completed: number;
    minutes: number;
    /** VND (integer đồng). Calculated from the teacher's current rates +
     *  completed sessions so far. */
    projectedIncome: number;
    paymentStructure: TeacherPaymentStructure;
  };
  /** True when the teacher has at least one active+primary payout method.
   *  When false the dashboard surfaces a yellow CTA banner pointing them
   *  to /dashboard/payouts so the admin can actually pay them. */
  hasPayoutMethod: boolean;
}

const VN_OFFSET = 7 * 3_600_000;

/** Vietnam-local "now" returned as a plain Date object whose UTC parts
 *  reflect the user's local time. Convenient for splitting into Y/M/D. */
function vnNow(): Date {
  return new Date(Date.now() + VN_OFFSET);
}

function startOfDayVn(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - VN_OFFSET,
  );
}

function endOfDayVn(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ) - VN_OFFSET,
  );
}

function startOfWeekVn(d: Date): Date {
  // Monday as week start (Vietnamese convention).
  const day = d.getUTCDay(); // 0 (Sun) - 6
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - diff * 24 * 3_600_000);
  return startOfDayVn(monday);
}

function endOfWeekVn(d: Date): Date {
  const sunday = new Date(startOfWeekVn(d).getTime() + 6 * 24 * 3_600_000);
  return endOfDayVn(new Date(sunday.getTime() + VN_OFFSET));
}

function startOfMonthVn(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - VN_OFFSET,
  );
}

function endOfMonthVn(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999) -
      VN_OFFSET,
  );
}

/** Compute the projected income for this month using the teacher's current
 *  rate config + completed minutes/sessions so far. Mirrors the calculator's
 *  formula in spirit but drops co-teacher splits / penalties (this is a
 *  forward-looking estimate, not the authoritative payroll number). */
function projectIncome(args: {
  paymentStructure: TeacherPaymentStructure;
  hourlyRate: number;
  perSessionRate: number | null;
  fixedMonthly: number | null;
  completedMinutes: number;
  completedSessions: number;
}): number {
  const {
    paymentStructure,
    hourlyRate,
    perSessionRate,
    fixedMonthly,
    completedMinutes,
    completedSessions,
  } = args;

  let total = 0;
  if (paymentStructure === "HOURLY" || paymentStructure === "HYBRID") {
    total += Math.floor((completedMinutes * hourlyRate) / 60);
  }
  if (paymentStructure === "PER_SESSION" || paymentStructure === "HYBRID") {
    total += completedSessions * (perSessionRate ?? 0);
  }
  if (paymentStructure === "FIXED_MONTHLY" || paymentStructure === "HYBRID") {
    total += fixedMonthly ?? 0;
  }
  return total;
}

export async function getTeacherDashboardData(): Promise<TeacherDashboardData | null> {
  try {
    const { supabase, tenant, currentTeacherId } =
      await getCurrentTenantContext();
    if (!currentTeacherId) return null;

    const supa = supabase;
    const now = vnNow();

    const todayStart = startOfDayVn(now).toISOString();
    const todayEnd = endOfDayVn(now).toISOString();
    const weekStart = startOfWeekVn(now).toISOString();
    const weekEnd = endOfWeekVn(now).toISOString();
    const monthStart = startOfMonthVn(now).toISOString();
    const monthEnd = endOfMonthVn(now).toISOString();
    const nowIso = new Date().toISOString();

    // Pull all sessions in the widest window we need (the month). Then split
    // into today / week / month locally — one DB roundtrip instead of three.
    // The embedded course read needs migration 0025's RLS policy to be
    // applied; if it isn't, course is just null in the response — harmless.
    const { data: rows } = await supa
      .from("live_sessions")
      .select(
        "id, title, start_time, duration_minutes, is_cancelled, course:courses!live_sessions_course_id_fkey(title)",
      )
      .eq("tenant_id", tenant.id)
      .eq("teacher_id", currentTeacherId)
      .gte("start_time", monthStart)
      .lte("start_time", monthEnd)
      .order("start_time", { ascending: true });

    type Row = NonNullable<typeof rows>[number];

    const inWindow = (r: Row, start: string, end: string) =>
      r.start_time >= start && r.start_time <= end;

    const todayRows = (rows ?? []).filter((r) =>
      inWindow(r, todayStart, todayEnd),
    );
    const weekRows = (rows ?? []).filter((r) =>
      inWindow(r, weekStart, weekEnd),
    );

    // Completed = past start_time AND not cancelled. (We don't have check-in
    // timestamps yet, so we assume scheduled duration was delivered.)
    const isCompleted = (r: Row) =>
      !r.is_cancelled && r.start_time <= nowIso;
    const isUpcoming = (r: Row) =>
      !r.is_cancelled && r.start_time > nowIso;

    const weekCompletedMinutes = weekRows
      .filter(isCompleted)
      .reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0);
    const weekCompletedCount = weekRows.filter(isCompleted).length;
    const weekUpcomingCount = weekRows.filter(isUpcoming).length;

    const monthCompletedRows = (rows ?? []).filter(isCompleted);
    const monthMinutes = monthCompletedRows.reduce(
      (sum, r) => sum + (r.duration_minutes ?? 0),
      0,
    );
    const monthCount = monthCompletedRows.length;

    // Teacher pay config (current — not the period snapshot, since this is a
    // forward projection).
    const { data: slot } = await supa
      .from("tenant_teachers")
      .select(
        "payment_structure, hourly_rate, per_session_rate, fixed_monthly_amount",
      )
      .eq("id", currentTeacherId)
      .maybeSingle();

    const paymentStructure =
      (slot?.payment_structure as TeacherPaymentStructure | undefined) ??
      "HOURLY";

    const projectedIncome = projectIncome({
      paymentStructure,
      hourlyRate: slot?.hourly_rate ?? 0,
      perSessionRate: slot?.per_session_rate ?? null,
      fixedMonthly: slot?.fixed_monthly_amount ?? null,
      completedMinutes: monthMinutes,
      completedSessions: monthCount,
    });

    // Does the teacher have a primary payout method configured?
    const { count: methodCount } = await supa
      .from("teacher_payout_methods")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", currentTeacherId)
      .eq("is_primary", true)
      .eq("is_active", true);
    const hasPayoutMethod = (methodCount ?? 0) > 0;

    return {
      todaySessions: todayRows.map((r) => ({
        id: r.id,
        title: r.title,
        start_time: r.start_time,
        duration_minutes: r.duration_minutes ?? 0,
        is_cancelled: r.is_cancelled,
        course_title:
          (r.course as { title?: string | null } | null)?.title ?? null,
      })),
      weekStats: {
        completed: weekCompletedCount,
        minutes: weekCompletedMinutes,
        upcoming: weekUpcomingCount,
      },
      monthStats: {
        completed: monthCount,
        minutes: monthMinutes,
        projectedIncome,
        paymentStructure,
      },
      hasPayoutMethod,
    };
  } catch {
    return null;
  }
}
