/**
 * Payroll calculator — Phase A TDD fixtures.
 *
 * 15 scenarios per PRD §5.8 + Appendix A. Every test should be RED
 * until Phase B implements `calculatePayroll`.
 *
 * Currency assertions are exact integers (VND). Hours are stored as
 * integer minutes internally so 1.5h = 90 min, never 1.5.
 *
 * Conventions:
 *   - Teacher id "T1" is the subject teacher; "T2", "T3" are others.
 *   - Center timezone is Asia/Ho_Chi_Minh (UTC+7) unless noted.
 *   - Session timestamps are ISO with explicit +07:00 offset so the
 *     calculator doesn't have to guess.
 *   - Period bounds are inclusive YYYY-MM-DD in the center tz.
 */

import { describe, expect, it } from "vitest";
import { calculatePayroll } from "./calculator";
import type {
  AuditEntry,
  ManualAdjustment,
  PayrollInput,
  PayrollResult,
  PayrollRules,
  Period,
  Session,
  SessionStatus,
  Teacher,
} from "./types";

// ─── Test helpers ────────────────────────────────────────────────────────────

const HCMC = "Asia/Ho_Chi_Minh";
const OCTOBER_2026: Period = {
  start: "2026-10-01",
  end: "2026-10-31",
  timezone: HCMC,
};

/** Sensible default rules: no late penalty, EQUAL co-teacher split, 1.1× cap. */
function defaultRules(overrides: Partial<PayrollRules> = {}): PayrollRules {
  return {
    hours_cap_multiplier: 1.1,
    completion_factor: 1.0,
    late_grace_minutes: 5,
    late_penalty_per_minute: 0, // disabled by default
    co_teacher_split: "EQUAL",
    ...overrides,
  };
}

function teacher(overrides: Partial<Teacher> & Pick<Teacher, "id">): Teacher {
  return {
    payment_structure: "HOURLY",
    hourly_rate: 200_000,
    per_session_rate: null,
    fixed_monthly_amount: null,
    ...overrides,
  };
}

/**
 * Build a session. Defaults to a 1-hour COMPLETED session at 19:00 HCMC on
 * 2026-10-15 with check-in / check-out exactly matching the schedule.
 */
function session(overrides: Partial<Session> & Pick<Session, "id" | "assigned_teacher_id">): Session {
  const date = overrides.date ?? "2026-10-15";
  const start = overrides.start_time ?? "19:00";
  const end = overrides.end_time ?? "20:00";
  return {
    class_id: "C1",
    date,
    start_time: start,
    end_time: end,
    status: "COMPLETED" satisfies SessionStatus,
    teacher_checkin_at: `${date}T${start}:00+07:00`,
    teacher_checkout_at: `${date}T${end}:00+07:00`,
    ...overrides,
  };
}

function bonus(amount: number, reason = "Bonus"): ManualAdjustment {
  return { type: "BONUS", amount, reason };
}

function deduction(amount: number, reason = "Deduction"): ManualAdjustment {
  return { type: "DEDUCTION", amount, reason };
}

function input(over: Partial<PayrollInput> & Pick<PayrollInput, "teacher">): PayrollInput {
  return {
    sessions: [],
    attendance: [],
    adjustments: [],
    period: OCTOBER_2026,
    rules: defaultRules(),
    ...over,
  };
}

function hasAudit(result: PayrollResult, kind: AuditEntry["kind"]): boolean {
  return result.audit_trail.some((e) => e.kind === kind);
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC (1–5)
// ─────────────────────────────────────────────────────────────────────────────

describe("payroll — basic structures", () => {
  it("1. Pure HOURLY, 20 completed sessions, no adjustments", () => {
    // 20 sessions × 1h × 250,000 VND/h = 5,000,000 VND.
    // Each session has check-in/out matching the schedule, so actual
    // hours == scheduled hours; no cap, no penalty, no adjustment.
    const t = teacher({ id: "T1", hourly_rate: 250_000 });
    const sessions = Array.from({ length: 20 }, (_, i) =>
      session({
        id: `S${i + 1}`,
        assigned_teacher_id: "T1",
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      }),
    );

    const r = calculatePayroll(input({ teacher: t, sessions }));

    expect(r.breakdown.hours_taught_minutes).toBe(20 * 60);
    expect(r.breakdown.sessions_paid).toBe(20);
    expect(r.breakdown.hourly_pay).toBe(5_000_000);
    expect(r.breakdown.per_session_pay).toBe(0);
    expect(r.breakdown.fixed_monthly_pay).toBe(0);
    expect(r.breakdown.calculated_amount).toBe(5_000_000);
    expect(r.final_amount).toBe(5_000_000);
  });

  it("2. Pure PER_SESSION, 15 completed sessions", () => {
    // 15 sessions × 200,000 VND each = 3,000,000 VND. Session length
    // is irrelevant for PER_SESSION pay; only the count matters.
    const t = teacher({
      id: "T1",
      payment_structure: "PER_SESSION",
      hourly_rate: 0,
      per_session_rate: 200_000,
    });
    const sessions = Array.from({ length: 15 }, (_, i) =>
      session({
        id: `S${i + 1}`,
        assigned_teacher_id: "T1",
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      }),
    );

    const r = calculatePayroll(input({ teacher: t, sessions }));

    expect(r.breakdown.sessions_paid).toBe(15);
    expect(r.breakdown.per_session_pay).toBe(3_000_000);
    expect(r.breakdown.hourly_pay).toBe(0);
    expect(r.final_amount).toBe(3_000_000);
  });

  it("3. Pure FIXED_MONTHLY ignores per-session count", () => {
    // 25 completed sessions don't change pay — fixed_monthly_amount
    // is what the teacher takes home (PRD §5.8). Sessions still
    // appear in the breakdown for traceability.
    const t = teacher({
      id: "T1",
      payment_structure: "FIXED_MONTHLY",
      hourly_rate: 0,
      fixed_monthly_amount: 12_000_000,
    });
    const sessions = Array.from({ length: 25 }, (_, i) =>
      session({
        id: `S${i + 1}`,
        assigned_teacher_id: "T1",
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      }),
    );

    const r = calculatePayroll(input({ teacher: t, sessions }));

    expect(r.breakdown.fixed_monthly_pay).toBe(12_000_000);
    expect(r.breakdown.hourly_pay).toBe(0);
    expect(r.breakdown.per_session_pay).toBe(0);
    expect(r.final_amount).toBe(12_000_000);
    expect(hasAudit(r, "FIXED_MONTHLY_PAY")).toBe(true);
  });

  it("4. HYBRID: fixed monthly + per-session top-up", () => {
    // Fixed 10,000,000 base + 50,000 VND per attended session × 10
    // sessions = 10,500,000. HYBRID stacks the per_session_rate on
    // top of fixed_monthly_amount (PRD §5.8 sums components).
    const t = teacher({
      id: "T1",
      payment_structure: "HYBRID",
      hourly_rate: 0,
      per_session_rate: 50_000,
      fixed_monthly_amount: 10_000_000,
    });
    const sessions = Array.from({ length: 10 }, (_, i) =>
      session({
        id: `S${i + 1}`,
        assigned_teacher_id: "T1",
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      }),
    );

    const r = calculatePayroll(input({ teacher: t, sessions }));

    expect(r.breakdown.fixed_monthly_pay).toBe(10_000_000);
    expect(r.breakdown.per_session_pay).toBe(500_000);
    expect(r.breakdown.calculated_amount).toBe(10_500_000);
    expect(r.final_amount).toBe(10_500_000);
  });

  it("5. HOURLY with manual bonus + deduction (Appendix A example)", () => {
    // From PRD Appendix A: Cô Linh, HOURLY @ 250,000.
    // 30 of 32 sessions COMPLETED (2 cancelled — not in this fixture).
    // Total actual hours = 44.5 = 2670 min across the 30 completed sessions.
    // Modeled here as 30 sessions × 1.5h = 45h, but session 30 is
    // 30 min shorter (60 min instead of 90), giving 2670 min total.
    // +500,000 bonus (perfect attendance) -100,000 deduction (late twice).
    // Expected final: 11,125,000 + 500,000 − 100,000 = 11,525,000.
    const t = teacher({ id: "T1", hourly_rate: 250_000 });

    const sessions: Session[] = [];
    for (let i = 0; i < 29; i++) {
      // 18:00 → 19:30, 90 min, fully attended
      sessions.push(
        session({
          id: `S${i + 1}`,
          assigned_teacher_id: "T1",
          date: `2026-10-${String(i + 1).padStart(2, "0")}`,
          start_time: "18:00",
          end_time: "19:30",
        }),
      );
    }
    // Session 30: 18:00 → 19:30 scheduled but teacher checked out at 19:00
    // → 60 min actual. (29 × 90) + 60 = 2670 min = 44.5h.
    sessions.push({
      id: "S30",
      class_id: "C1",
      assigned_teacher_id: "T1",
      date: "2026-10-30",
      start_time: "18:00",
      end_time: "19:30",
      status: "COMPLETED",
      teacher_checkin_at: "2026-10-30T18:00:00+07:00",
      teacher_checkout_at: "2026-10-30T19:00:00+07:00",
    });

    const r = calculatePayroll(
      input({
        teacher: t,
        sessions,
        adjustments: [
          bonus(500_000, "Đi học đầy đủ tháng 10"),
          deduction(100_000, "Đi trễ 2 lần"),
        ],
      }),
    );

    expect(r.breakdown.hours_taught_minutes).toBe(2670);
    expect(r.breakdown.hourly_pay).toBe(11_125_000);
    expect(r.breakdown.bonuses).toBe(500_000);
    expect(r.breakdown.deductions).toBe(100_000);
    expect(r.final_amount).toBe(11_525_000);
    expect(hasAudit(r, "BONUS")).toBe(true);
    expect(hasAudit(r, "DEDUCTION")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES (6–10)
// ─────────────────────────────────────────────────────────────────────────────

describe("payroll — edge cases", () => {
  it("6. CANCELLED sessions are excluded from pay", () => {
    // 10 sessions assigned: 9 COMPLETED + 1 CANCELLED. Only the 9
    // completed count toward HOURLY pay. The cancelled session must
    // appear in the audit trail with kind SESSION_SKIPPED so the
    // breakdown UI can show "skipped: cancelled" (PRD §5.8 transparency).
    const t = teacher({ id: "T1", hourly_rate: 200_000 });

    const sessions: Session[] = [];
    for (let i = 0; i < 9; i++) {
      sessions.push(
        session({
          id: `S${i + 1}`,
          assigned_teacher_id: "T1",
          date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        }),
      );
    }
    sessions.push(
      session({
        id: "S10",
        assigned_teacher_id: "T1",
        date: "2026-10-10",
        status: "CANCELLED",
        teacher_checkin_at: null,
        teacher_checkout_at: null,
      }),
    );

    const r = calculatePayroll(input({ teacher: t, sessions }));

    expect(r.breakdown.sessions_paid).toBe(9);
    expect(r.breakdown.hourly_pay).toBe(9 * 200_000);
    expect(r.final_amount).toBe(1_800_000);
    expect(hasAudit(r, "SESSION_SKIPPED")).toBe(true);
  });

  it("7. SUBSTITUTE teacher: pay goes to substitute, not original", () => {
    // Session originally was T1's lesson but T1 was sick. Center
    // re-assigned the session to T2 (substitute). assigned_teacher_id
    // at completion time = "T2". When we compute payroll FOR T2, the
    // session counts. PRD §5.8: "pay goes to substitute, not original".
    const t1 = teacher({ id: "T1", hourly_rate: 200_000 });
    const t2 = teacher({ id: "T2", hourly_rate: 300_000 });

    const sessions: Session[] = [
      // T1's own session
      session({
        id: "S1",
        assigned_teacher_id: "T1",
        date: "2026-10-10",
      }),
      // Originally T1's but reassigned to T2
      session({
        id: "S2",
        assigned_teacher_id: "T2",
        date: "2026-10-11",
      }),
    ];

    // T1 only paid for S1 (their own).
    const t1Result = calculatePayroll(input({ teacher: t1, sessions }));
    expect(t1Result.breakdown.sessions_paid).toBe(1);
    expect(t1Result.breakdown.hourly_pay).toBe(200_000);

    // T2 paid for S2 at T2's rate, not T1's.
    const t2Result = calculatePayroll(input({ teacher: t2, sessions }));
    expect(t2Result.breakdown.sessions_paid).toBe(1);
    expect(t2Result.breakdown.hourly_pay).toBe(300_000);
    expect(hasAudit(t2Result, "SUBSTITUTE_PAY") || hasAudit(t2Result, "SESSION_PAY")).toBe(true);
  });

  it("8. PARTIAL session: actual hours < scheduled, pro-rate down", () => {
    // Scheduled 18:00–20:00 (120 min). Teacher checked in 18:00 but
    // checked out 19:00 (60 min actual). HOURLY @ 200,000 → 200,000.
    // No cap (60 < 120 × 1.1 = 132), no penalty (no lateness).
    const t = teacher({ id: "T1", hourly_rate: 200_000 });
    const s = session({
      id: "S1",
      assigned_teacher_id: "T1",
      date: "2026-10-10",
      start_time: "18:00",
      end_time: "20:00",
      teacher_checkin_at: "2026-10-10T18:00:00+07:00",
      teacher_checkout_at: "2026-10-10T19:00:00+07:00",
    });

    const r = calculatePayroll(input({ teacher: t, sessions: [s] }));

    expect(r.breakdown.hours_taught_minutes).toBe(60);
    expect(r.breakdown.hourly_pay).toBe(200_000);
    expect(r.final_amount).toBe(200_000);
  });

  it("9. LATE check-in with penalty applied", () => {
    // Scheduled 18:00–19:30 (90 min). Teacher checked in 18:15 (15
    // min late), checked out 19:30 → 75 min actual.
    // HOURLY @ 200,000 → 75/60 × 200,000 = 250,000.
    // Late penalty: (15 − 5 grace) × 10,000 = 100,000.
    // Expected final = 250,000 − 100,000 = 150,000.
    // (Penalty is an automatic_penalty, not a manual deduction.)
    const t = teacher({ id: "T1", hourly_rate: 200_000 });
    const s = session({
      id: "S1",
      assigned_teacher_id: "T1",
      date: "2026-10-10",
      start_time: "18:00",
      end_time: "19:30",
      teacher_checkin_at: "2026-10-10T18:15:00+07:00",
      teacher_checkout_at: "2026-10-10T19:30:00+07:00",
    });

    const r = calculatePayroll(
      input({
        teacher: t,
        sessions: [s],
        rules: defaultRules({
          late_grace_minutes: 5,
          late_penalty_per_minute: 10_000,
        }),
      }),
    );

    expect(r.breakdown.hours_taught_minutes).toBe(75);
    expect(r.breakdown.hourly_pay).toBe(250_000);
    expect(r.breakdown.automatic_penalties).toBe(100_000);
    expect(r.final_amount).toBe(150_000);
    expect(hasAudit(r, "LATE_PENALTY")).toBe(true);
  });

  it("10. MULTI-TEACHER co-teaching session: split EQUALLY", () => {
    // 1 session, 2 hours, T1 + T2 co-teaching. EQUAL split means
    // each gets half the hourly pay. T1 @ 200,000/h → 2h × 200,000 / 2
    // = 200,000 (T1's share). audit_trail must show CO_TEACHER_SPLIT.
    const t1 = teacher({ id: "T1", hourly_rate: 200_000 });
    const s = session({
      id: "S1",
      assigned_teacher_id: "T1",
      date: "2026-10-10",
      start_time: "18:00",
      end_time: "20:00",
      co_teacher_ids: ["T2"],
      teacher_checkin_at: "2026-10-10T18:00:00+07:00",
      teacher_checkout_at: "2026-10-10T20:00:00+07:00",
    });

    const r = calculatePayroll(
      input({
        teacher: t1,
        sessions: [s],
        rules: defaultRules({ co_teacher_split: "EQUAL" }),
      }),
    );

    expect(r.breakdown.hours_taught_minutes).toBe(120);
    expect(r.breakdown.hourly_pay).toBe(200_000); // 2h × 200k / 2
    expect(r.final_amount).toBe(200_000);
    expect(hasAudit(r, "CO_TEACHER_SPLIT")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEIRD CASES (11–15)
// ─────────────────────────────────────────────────────────────────────────────

describe("payroll — boundary + correctness", () => {
  it("11. Zero sessions in period — final = 0, no errors", () => {
    // No sessions, no adjustments. The calculator must NOT throw and
    // must return a fully zero-filled breakdown. This is the "new
    // teacher who hasn't taught yet" case at end-of-month payroll.
    const t = teacher({ id: "T1" });

    const r = calculatePayroll(input({ teacher: t }));

    expect(r.breakdown.sessions_paid).toBe(0);
    expect(r.breakdown.hours_taught_minutes).toBe(0);
    expect(r.breakdown.hourly_pay).toBe(0);
    expect(r.breakdown.per_session_pay).toBe(0);
    expect(r.breakdown.fixed_monthly_pay).toBe(0);
    expect(r.breakdown.bonuses).toBe(0);
    expect(r.breakdown.deductions).toBe(0);
    expect(r.breakdown.calculated_amount).toBe(0);
    expect(r.final_amount).toBe(0);
    expect(r.audit_trail).toEqual([]);
  });

  it("12. Deduction larger than earned → final clamped to 0 (never negative)", () => {
    // Earned: 1h × 100,000 = 100,000. Manual deduction: 500,000.
    // Raw final would be −400,000, but payroll must never go below 0
    // (no one pays the center; an admin would re-issue a smaller
    // deduction next month). audit_trail records the NEGATIVE_CLAMP
    // with the would-be amount so the admin sees what happened.
    const t = teacher({ id: "T1", hourly_rate: 100_000 });
    const s = session({
      id: "S1",
      assigned_teacher_id: "T1",
      date: "2026-10-10",
    });

    const r = calculatePayroll(
      input({
        teacher: t,
        sessions: [s],
        adjustments: [deduction(500_000, "Tổn thất thiết bị")],
      }),
    );

    expect(r.breakdown.hourly_pay).toBe(100_000);
    expect(r.breakdown.deductions).toBe(500_000);
    expect(r.breakdown.calculated_amount).toBe(100_000); // pre-deduction gross
    expect(r.final_amount).toBe(0); // clamped, NOT −400,000
    expect(hasAudit(r, "NEGATIVE_CLAMP")).toBe(true);
  });

  it("13. Period spanning a month boundary (Oct 28 – Nov 3)", () => {
    // 4 candidate sessions; only 2 fall inside the inclusive bounds.
    //   Oct 27 → outside (before start)
    //   Oct 30 → inside
    //   Nov 1  → inside
    //   Nov 5  → outside (after end)
    // Each 1h HOURLY @ 200,000 → 400,000 total.
    const t = teacher({ id: "T1", hourly_rate: 200_000 });
    const sessions: Session[] = [
      session({ id: "S0", assigned_teacher_id: "T1", date: "2026-10-27" }),
      session({ id: "S1", assigned_teacher_id: "T1", date: "2026-10-30" }),
      session({ id: "S2", assigned_teacher_id: "T1", date: "2026-11-01" }),
      session({ id: "S3", assigned_teacher_id: "T1", date: "2026-11-05" }),
    ];

    const r = calculatePayroll(
      input({
        teacher: t,
        sessions,
        period: { start: "2026-10-28", end: "2026-11-03", timezone: HCMC },
      }),
    );

    expect(r.breakdown.sessions_paid).toBe(2);
    expect(r.breakdown.hourly_pay).toBe(400_000);
    expect(r.final_amount).toBe(400_000);
  });

  it("14. Leap day (Feb 29, 2028) is a valid in-period date", () => {
    // 2028 is a leap year. A session on Feb 29 inside a Feb 1–29
    // period must be counted. (Vietnam keeps Gregorian — no
    // localization weirdness — but date math libs sometimes drop
    // Feb 29 if mis-handled.)
    const t = teacher({ id: "T1", hourly_rate: 200_000 });
    const s = session({
      id: "S1",
      assigned_teacher_id: "T1",
      date: "2028-02-29",
      teacher_checkin_at: "2028-02-29T19:00:00+07:00",
      teacher_checkout_at: "2028-02-29T20:00:00+07:00",
    });

    const r = calculatePayroll(
      input({
        teacher: t,
        sessions: [s],
        period: { start: "2028-02-01", end: "2028-02-29", timezone: HCMC },
      }),
    );

    expect(r.breakdown.sessions_paid).toBe(1);
    expect(r.breakdown.hourly_pay).toBe(200_000);
    expect(r.final_amount).toBe(200_000);
  });

  it("15. Timezone edge: 23:59 HCMC on last day of period must COUNT", () => {
    // Period: October 2026 in Asia/Ho_Chi_Minh (UTC+7).
    // Session A: 2026-10-31 23:30–23:59 HCMC → must count as October.
    //   ISO: 2026-10-31T23:30+07:00 = 2026-10-31T16:30Z.
    // Session B: 2026-11-01 00:30–01:00 HCMC → must NOT count.
    //   ISO: 2026-11-01T00:30+07:00 = 2026-10-31T17:30Z.
    //   A calculator that naively pulls the UTC date from the ISO
    //   string would attribute this to October (BUG). The test
    //   asserts it's correctly attributed to November.
    const t = teacher({ id: "T1", hourly_rate: 240_000 }); // 4,000 VND/min
    const sessions: Session[] = [
      session({
        id: "A",
        assigned_teacher_id: "T1",
        date: "2026-10-31",
        start_time: "23:30",
        end_time: "23:59",
        teacher_checkin_at: "2026-10-31T23:30:00+07:00",
        teacher_checkout_at: "2026-10-31T23:59:00+07:00",
      }),
      session({
        id: "B",
        assigned_teacher_id: "T1",
        date: "2026-11-01",
        start_time: "00:30",
        end_time: "01:00",
        teacher_checkin_at: "2026-11-01T00:30:00+07:00",
        teacher_checkout_at: "2026-11-01T01:00:00+07:00",
      }),
    ];

    const r = calculatePayroll(input({ teacher: t, sessions }));

    // Only Session A (29 minutes) counts.
    expect(r.breakdown.sessions_paid).toBe(1);
    expect(r.breakdown.hours_taught_minutes).toBe(29);
    // 29 min × 4,000 VND/min = 116,000.
    expect(r.breakdown.hourly_pay).toBe(116_000);
    expect(r.final_amount).toBe(116_000);
  });
});
