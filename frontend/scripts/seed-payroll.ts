/**
 * scripts/seed-payroll.ts
 *
 * Cycle 6 deliverable: constructs a fully worked payroll example,
 * writes a real Excel file to /tmp/sample-payroll.xlsx, and (if
 * Supabase env vars are set) inserts the same data into the centers /
 * payroll_periods / payroll_items tables.
 *
 *   Always:    in-memory data → calculator → Excel → /tmp/sample-payroll.xlsx
 *   With env:  also INSERT into Supabase (center + period + 3 items)
 *
 * Run: pnpm seed:payroll
 *
 * Env (optional):
 *   SUPABASE_URL                 — project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (admin operations)
 *
 * Notes:
 * - This script imports modules with the "@/" Next path alias via tsx.
 *   tsx reads tsconfig.json paths automatically.
 * - The calculator + Excel modules import "server-only", which is a
 *   no-op at runtime outside Next's bundle. The module loads fine.
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { calculatePayroll } from "../src/modules/payroll/calculator";
import { buildPayrollWorkbook } from "../src/modules/payroll/excel";
import type {
  PayrollItemRow,
  PayrollPeriodRow,
  StoredAdjustment,
  TeacherSnapshot,
} from "../src/modules/payroll/domain-types";
import type {
  AuditEntry,
  PayrollRules,
  Session,
} from "../src/modules/payroll/types";

// ─── Center + teachers + period boundaries ──────────────────────────────────

const CENTER_ID = randomUUID();
const CENTER_NAME = "Trung tâm Anh ngữ Demo";
const CENTER_ADDRESS = "12 Phan Đình Phùng, Q. Ba Đình, Hà Nội";

const NOW = new Date();
const PREV_MONTH_LAST = new Date(NOW.getFullYear(), NOW.getMonth(), 0);
const PREV_MONTH_FIRST = new Date(
  PREV_MONTH_LAST.getFullYear(),
  PREV_MONTH_LAST.getMonth(),
  1,
);
const PERIOD_START = isoDate(PREV_MONTH_FIRST);
const PERIOD_END = isoDate(PREV_MONTH_LAST);

const DEFAULT_RULES: PayrollRules = {
  hours_cap_multiplier: 1.1,
  completion_factor: 1.0,
  late_grace_minutes: 5,
  late_penalty_per_minute: 0,
  co_teacher_split: "EQUAL",
  pay_on_cancel: {
    BY_CENTER: true,
    BY_TEACHER: false,
    BY_STUDENT: false,
    FORCE_MAJEURE: true,
  },
};

// ─── Teachers ───────────────────────────────────────────────────────────────

const teacherA: TeacherSnapshot = {
  id: randomUUID(),
  name: "Cô Nguyễn Thị A",
  mst: "8567894321",
  payment_structure: "HOURLY",
  hourly_rate: 250_000,
  per_session_rate: null,
  fixed_monthly_amount: null,
};

const teacherB: TeacherSnapshot = {
  id: randomUUID(),
  name: "Cô Trần Thị B",
  mst: "8123456789",
  payment_structure: "PER_SESSION",
  hourly_rate: 0,
  per_session_rate: 400_000,
  fixed_monthly_amount: null,
};

const teacherC: TeacherSnapshot = {
  id: randomUUID(),
  name: "Thầy Lê Văn C",
  mst: null,
  payment_structure: "FIXED_MONTHLY",
  hourly_rate: 0,
  per_session_rate: null,
  fixed_monthly_amount: 8_000_000,
};

// ─── Sessions (synthetic, in-period) ────────────────────────────────────────

function makeSession(
  teacherId: string,
  day: number,
  startHour: number,
  endHour: number,
  endMinute = 0,
): Session {
  const date = `${PREV_MONTH_FIRST.getFullYear()}-${String(
    PREV_MONTH_FIRST.getMonth() + 1,
  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const start = `${String(startHour).padStart(2, "0")}:00`;
  const end = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  return {
    id: randomUUID(),
    class_id: "C-DEMO",
    date,
    start_time: start,
    end_time: end,
    assigned_teacher_id: teacherId,
    status: "COMPLETED",
    teacher_checkin_at: `${date}T${start}:00+07:00`,
    teacher_checkout_at: `${date}T${end}:00+07:00`,
  };
}

// Cô A: HOURLY — 20 sessions × 1h30m = 1800 minutes = 30 hours
const sessionsA: Session[] = Array.from({ length: 20 }, (_, i) =>
  makeSession(teacherA.id, i + 1, 18, 19, 30),
);

// Cô B: PER_SESSION — 12 completed sessions, 1 cancelled (to show SESSION_SKIPPED)
const sessionsB: Session[] = Array.from({ length: 12 }, (_, i) =>
  makeSession(teacherB.id, i + 1, 19, 20, 30),
);
sessionsB.push({
  ...makeSession(teacherB.id, 13, 19, 20, 30),
  status: "CANCELLED",
  teacher_checkin_at: null,
  teacher_checkout_at: null,
});

// Thầy C: FIXED_MONTHLY — sessions for traceability; pay doesn't depend on them
const sessionsC: Session[] = Array.from({ length: 18 }, (_, i) =>
  makeSession(teacherC.id, i + 1, 8, 9, 30),
);

const ALL_SESSIONS = [...sessionsA, ...sessionsB, ...sessionsC];

// ─── Manual adjustments — one teacher gets both a bonus and a deduction ─────

const adjustmentsForA: StoredAdjustment[] = [
  {
    id: randomUUID(),
    type: "BONUS",
    amount: 500_000,
    reason: "Thưởng đi học đầy đủ tháng này",
    created_at: new Date().toISOString(),
    created_by: null,
  },
  {
    id: randomUUID(),
    type: "DEDUCTION",
    amount: 100_000,
    reason: "Đi trễ 2 lần",
    created_at: new Date().toISOString(),
    created_by: null,
  },
];

// ─── Calculate ──────────────────────────────────────────────────────────────

function calcItem(
  snapshot: TeacherSnapshot,
  manualAdjustments: StoredAdjustment[] = [],
): PayrollItemRow {
  const result = calculatePayroll({
    teacher: {
      id: snapshot.id,
      payment_structure: snapshot.payment_structure,
      hourly_rate: snapshot.hourly_rate,
      per_session_rate: snapshot.per_session_rate,
      fixed_monthly_amount: snapshot.fixed_monthly_amount,
    },
    sessions: ALL_SESSIONS,
    attendance: [],
    adjustments: manualAdjustments.map((a) => ({
      type: a.type,
      amount: a.amount,
      reason: a.reason,
    })),
    period: {
      start: PERIOD_START,
      end: PERIOD_END,
      timezone: "Asia/Ho_Chi_Minh",
    },
    rules: DEFAULT_RULES,
  });

  return {
    id: randomUUID(),
    payroll_period_id: "",
    teacher_id: snapshot.id,
    teacher_snapshot: snapshot,
    calculated_amount: result.breakdown.calculated_amount,
    final_amount: result.final_amount,
    adjustments: manualAdjustments,
    breakdown: result.breakdown,
    audit_trail: result.audit_trail as AuditEntry[],
    notes: "",
    payment_method: null,
    paid_at: null,
    paid_by: null,
    paid_note: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const period: PayrollPeriodRow = {
  id: randomUUID(),
  center_id: CENTER_ID,
  period_start: PERIOD_START,
  period_end: PERIOD_END,
  status: "DRAFT",
  approved_by: null,
  approved_at: null,
  paid_at: null,
  notes: "Bảng lương mẫu — Cycle 6 demo seed",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const items: PayrollItemRow[] = [
  calcItem(teacherA, adjustmentsForA),
  calcItem(teacherB),
  calcItem(teacherC),
].map((row) => ({ ...row, payroll_period_id: period.id }));

// ─── Main ───────────────────────────────────────────────────────────────────

const OUTPUT_PATH = "/tmp/sample-payroll.xlsx";

async function main() {
  // 1. Always: write Excel to /tmp/sample-payroll.xlsx
  const wb = buildPayrollWorkbook({
    period,
    items,
    center: { name: CENTER_NAME, address: CENTER_ADDRESS },
  });
  await wb.xlsx.writeFile(OUTPUT_PATH);

  console.log(`✓ Excel written: ${OUTPUT_PATH}`);
  console.log(`  Resolved path: ${path.resolve(OUTPUT_PATH)}`);
  console.log("");
  console.log("Summary:");
  items.forEach((it, i) => {
    const t = it.teacher_snapshot;
    console.log(
      `  ${i + 1}. ${t.name.padEnd(22)} ` +
        `${t.payment_structure.padEnd(14)} ` +
        `base ${it.calculated_amount.toLocaleString("vi-VN").padStart(12)}đ  ` +
        `final ${it.final_amount.toLocaleString("vi-VN").padStart(12)}đ`,
    );
  });
  const totalFinal = items.reduce((s, i) => s + i.final_amount, 0);
  console.log("  ─────────────────────────────────────────────────────");
  console.log(
    `  Total final lĩnh:  ${totalFinal.toLocaleString("vi-VN").padStart(40)}đ`,
  );

  // 2. Optionally: insert into Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log("");
    console.log(
      "ℹ️  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY not set — skipped DB insert.",
    );
    console.log("   To also seed the database:");
    console.log("     export SUPABASE_URL=...");
    console.log("     export SUPABASE_SERVICE_ROLE_KEY=...");
    console.log("     pnpm seed:payroll");
    return;
  }

  console.log("");
  console.log("→ Seeding Supabase...");

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  async function rest(pathSeg: string, init: RequestInit) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathSeg}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Supabase ${r.status} ${r.statusText}: ${body}`);
    }
    return r.json();
  }

  await rest("centers", {
    method: "POST",
    body: JSON.stringify({
      id: CENTER_ID,
      name: CENTER_NAME,
      address: CENTER_ADDRESS,
      timezone: "Asia/Ho_Chi_Minh",
      currency: "VND",
    }),
  });
  console.log(`  ✓ center ${CENTER_NAME}`);

  await rest("payroll_periods", {
    method: "POST",
    body: JSON.stringify({
      id: period.id,
      center_id: CENTER_ID,
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      status: "DRAFT",
      notes: period.notes,
    }),
  });
  console.log(`  ✓ period ${PERIOD_START} → ${PERIOD_END}`);

  for (const it of items) {
    await rest("payroll_items", {
      method: "POST",
      body: JSON.stringify({
        id: it.id,
        payroll_period_id: period.id,
        teacher_id: it.teacher_id,
        teacher_snapshot: it.teacher_snapshot,
        calculated_amount: it.calculated_amount,
        final_amount: it.final_amount,
        adjustments: it.adjustments,
        breakdown: it.breakdown,
        audit_trail: it.audit_trail,
      }),
    });
    console.log(`  ✓ item ${it.teacher_snapshot.name}`);
  }

  console.log("");
  console.log(`Done. Open /admin/payroll/${period.id} to inspect in the UI.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
