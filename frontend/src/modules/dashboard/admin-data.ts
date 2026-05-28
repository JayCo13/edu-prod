/**
 * Data feed for AdminDashboard.
 *
 * Server-only helper that pulls today's sessions, action items, this-month
 * financials, and the recent audit trail for the current tenant.
 *
 * Uses the admin (service-role) Supabase client because:
 *   - audit_logs RLS is center_id-scoped via is_center_admin(); user-scoped
 *     reads can fail if the centers backfill (migration 0022) wasn't run.
 *   - Admins legitimately see ALL tenant data on this screen.
 * The caller has been gated by getCurrentTenantContext + isAdmin upstream
 * (server page checks), so bypassing RLS here is safe.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

interface SessionLite {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
  is_cancelled: boolean;
  teacher_name: string | null;
  course_title: string | null;
}

interface TodoTeacher {
  id: string;
  display_name: string;
}

interface TodoPeriod {
  id: string;
  period_start: string;
  status: "DRAFT" | "APPROVED";
  unpaidCount: number;
}

interface FinancialStats {
  monthLabel: string;
  /** Sum of final_amount across ALL items in periods that overlap this
   *  month. VND integers. */
  totalPayroll: number;
  /** payroll_items.paid_at IS NOT NULL within the current month. */
  paidThisMonth: number;
  sessionsCount: number;
  activeTeachers: number;
  configuredRates: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  created_at: string;
  /** Plain Vietnamese sentence for display. */
  summary: string;
  /** Actor display name (from metadata.actor_name when present). */
  actorName: string | null;
}

export interface AdminDashboardData {
  todaySessions: SessionLite[];
  todo: {
    teachersWithoutRate: TodoTeacher[];
    pendingPeriods: TodoPeriod[];
  };
  finance: FinancialStats;
  recentActivity: ActivityEntry[];
}

const VN_OFFSET_MS = 7 * 3_600_000;

function vnNow(): Date {
  return new Date(Date.now() + VN_OFFSET_MS);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function startOfDayVnIso(d: Date): string {
  const utc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  return new Date(utc - VN_OFFSET_MS).toISOString();
}

function endOfDayVnIso(d: Date): string {
  const utc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23,
    59,
    59,
    999,
  );
  return new Date(utc - VN_OFFSET_MS).toISOString();
}

function startOfMonthVnIso(d: Date): string {
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return new Date(utc - VN_OFFSET_MS).toISOString();
}

function endOfMonthVnIso(d: Date): string {
  const utc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return new Date(utc - VN_OFFSET_MS).toISOString();
}

/** Map a dotted audit action key to a Vietnamese sentence. Unknown keys
 *  fall back to the raw key — we'd rather render something than nothing. */
function summarizeAction(action: string, metadata: unknown): string {
  const meta = (metadata ?? {}) as {
    target_name?: string;
    actor_name?: string;
    reason?: string;
    amount?: number;
    adjustment_type?: "BONUS" | "DEDUCTION";
  };
  const target = meta.target_name ? ` cho ${meta.target_name}` : "";
  switch (action) {
    case "payroll.adjustment.add":
      return meta.adjustment_type === "BONUS"
        ? `Thêm phụ cấp${target}`
        : `Thêm khấu trừ${target}`;
    case "payroll.adjustment.remove":
      return `Xoá điều chỉnh${target}`;
    case "payroll.period.approve":
      return "Duyệt kỳ lương";
    case "payroll.period.mark_paid":
      return "Đánh dấu kỳ lương đã thanh toán";
    case "payroll.item.mark_paid":
      return `Đánh dấu đã thanh toán${target}`;
    default:
      return action;
  }
}

function teacherHasNoRate(t: {
  payment_structure: string;
  hourly_rate: number | null;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
}): boolean {
  const noHourly = !t.hourly_rate || t.hourly_rate === 0;
  const noSession = t.per_session_rate == null || t.per_session_rate === 0;
  const noFixed =
    t.fixed_monthly_amount == null || t.fixed_monthly_amount === 0;
  switch (t.payment_structure) {
    case "HOURLY":
      return noHourly;
    case "PER_SESSION":
      return noSession;
    case "FIXED_MONTHLY":
      return noFixed;
    case "HYBRID":
      return noHourly && noSession && noFixed;
    default:
      return true;
  }
}

export async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  try {
    const { tenant } = await getCurrentTenantContext();
    const admin = createAdminClient();
    const now = vnNow();

    // Run everything in parallel — these queries don't depend on each other.
    const [
      todayRes,
      teachersRes,
      periodsRes,
      monthSessionsRes,
      monthPeriodsRes,
      activityRes,
    ] = await Promise.all([
      // 1. Today's sessions
      admin
        .from("live_sessions")
        .select(
          "id, title, start_time, duration_minutes, is_cancelled, course:courses!live_sessions_course_id_fkey(title), teacher:tenant_teachers!live_sessions_teacher_id_fkey(display_name)",
        )
        .eq("tenant_id", tenant.id)
        .gte("start_time", startOfDayVnIso(now))
        .lte("start_time", endOfDayVnIso(now))
        .order("start_time", { ascending: true }),

      // 2. Active teachers (count + rate-config issues)
      admin
        .from("tenant_teachers")
        .select(
          "id, display_name, payment_structure, hourly_rate, per_session_rate, fixed_monthly_amount",
        )
        .eq("tenant_id", tenant.id)
        .eq("is_active", true),

      // 3. Pending payroll periods (DRAFT or APPROVED) with their items'
      //    unpaid counts. We project items per period in the next reduce.
      admin
        .from("payroll_periods")
        .select(
          "id, period_start, status, items:payroll_items(id, paid_at)",
        )
        .eq("center_id", tenant.id)
        .in("status", ["DRAFT", "APPROVED"])
        .order("period_start", { ascending: false }),

      // 4. Sessions count this month
      admin
        .from("live_sessions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("start_time", startOfMonthVnIso(now))
        .lte("start_time", endOfMonthVnIso(now)),

      // 5. Periods overlapping this month → financial totals (sum across items).
      admin
        .from("payroll_periods")
        .select(
          "id, period_start, period_end, items:payroll_items(final_amount, paid_at)",
        )
        .eq("center_id", tenant.id)
        .gte("period_start", startOfMonthVnIso(now).slice(0, 10))
        .lte("period_end", endOfMonthVnIso(now).slice(0, 10)),

      // 6. Recent activity (last 6 entries on audit_logs for this center).
      admin
        .from("audit_logs")
        .select("id, action, metadata, created_at")
        .eq("center_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    // ── Project today's sessions ────────────────────────────────────
    type TodayRow = {
      id: string;
      title: string;
      start_time: string;
      duration_minutes: number | null;
      is_cancelled: boolean;
      course: { title?: string | null } | null;
      teacher: { display_name?: string | null } | null;
    };
    const todaySessions: SessionLite[] = ((todayRes.data ?? []) as TodayRow[])
      .map((r) => ({
        id: r.id,
        title: r.title,
        start_time: r.start_time,
        duration_minutes: r.duration_minutes ?? 0,
        is_cancelled: r.is_cancelled,
        teacher_name: r.teacher?.display_name ?? null,
        course_title: r.course?.title ?? null,
      }));

    // ── Action items ────────────────────────────────────────────────
    const teachers = teachersRes.data ?? [];
    const teachersWithoutRate: TodoTeacher[] = teachers
      .filter((t) =>
        teacherHasNoRate({
          payment_structure: t.payment_structure,
          hourly_rate: t.hourly_rate,
          per_session_rate: t.per_session_rate,
          fixed_monthly_amount: t.fixed_monthly_amount,
        }),
      )
      .map((t) => ({ id: t.id, display_name: t.display_name }));

    type PeriodRow = {
      id: string;
      period_start: string;
      status: "DRAFT" | "APPROVED" | "PAID";
      items: { paid_at: string | null }[] | null;
    };
    const pendingPeriods: TodoPeriod[] = (
      (periodsRes.data ?? []) as PeriodRow[]
    ).map((p) => ({
      id: p.id,
      period_start: p.period_start,
      status: p.status as "DRAFT" | "APPROVED",
      unpaidCount: (p.items ?? []).filter((i) => !i.paid_at).length,
    }));

    // ── Financial stats ─────────────────────────────────────────────
    type MonthPeriodRow = {
      id: string;
      items: { final_amount: number; paid_at: string | null }[] | null;
    };
    const monthPeriods = (monthPeriodsRes.data ?? []) as MonthPeriodRow[];
    const totalPayroll = monthPeriods.reduce(
      (sum, p) =>
        sum + (p.items ?? []).reduce((s, i) => s + (i.final_amount ?? 0), 0),
      0,
    );
    const paidThisMonth = monthPeriods.reduce(
      (sum, p) =>
        sum +
        (p.items ?? [])
          .filter((i) => !!i.paid_at)
          .reduce((s, i) => s + (i.final_amount ?? 0), 0),
      0,
    );

    const monthLabel = `Tháng ${pad2(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;

    const finance: FinancialStats = {
      monthLabel,
      totalPayroll,
      paidThisMonth,
      sessionsCount: monthSessionsRes.count ?? 0,
      activeTeachers: teachers.length,
      configuredRates: teachers.length - teachersWithoutRate.length,
    };

    // ── Recent activity ─────────────────────────────────────────────
    type ActivityRow = {
      id: string;
      action: string;
      metadata: unknown;
      created_at: string;
    };
    const recentActivity: ActivityEntry[] = (
      (activityRes.data ?? []) as ActivityRow[]
    ).map((r) => {
      const meta = (r.metadata ?? {}) as { actor_name?: string };
      return {
        id: r.id,
        action: r.action,
        created_at: r.created_at,
        summary: summarizeAction(r.action, r.metadata),
        actorName: meta.actor_name ?? null,
      };
    });

    return {
      todaySessions,
      todo: { teachersWithoutRate, pendingPeriods },
      finance,
      recentActivity,
    };
  } catch {
    return null;
  }
}
