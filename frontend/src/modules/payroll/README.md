# `modules/payroll/` — **KILLER FEATURE**

**Status:** BUILD (P0). This is the #1 reason centers will pay. Treat with extreme care.
**PRD:** [§5.8 Payroll](../../../../PRD.md#58-payroll-killer-feature), [Appendix A example](../../../../PRD.md#appendix-a-example-payroll-calculation).

## Entities (PRD §6)

- `payroll_periods` — `center_id`, `period_start`, `period_end`, `status` (`DRAFT | APPROVED | PAID`), `approved_by`, `approved_at`, `paid_at`.
- `payroll_items` — `payroll_period_id`, `teacher_id`, `calculated_amount`, `adjustments` (JSONB array of `{reason, amount}`), `final_amount`, `notes`.

Indexed `(payroll_period_id, teacher_id)`.

## Calculation logic (PRD §5.8)

```
Total Pay =
  + (Hours taught × Hourly rate)         if HOURLY
  + (Sessions taught × Per-session rate) if PER_SESSION
  + Fixed monthly salary                 if FIXED_MONTHLY
  + Bonuses (manual)
  - Deductions (manual)
```

**Hours taught:**
- Only count sessions with `status = COMPLETED`.
- `hours = checkout - checkin`, capped at `scheduled_duration × 1.1`.
- If no check-in/out, fall back to `scheduled_duration × completion_factor` (configurable per center).

**Edge cases — all must be handled:**
- Cancelled sessions: don't count.
- **Substituted sessions: pay goes to substitute, not original teacher.** Use `sessions.assigned_teacher_id` at completion time.
- Partial sessions: pro-rate by actual hours.
- Late check-in: configurable penalty per center.
- Multi-teacher (co-teaching): split pay configurable.

## Engine location

The pure calculation engine should live in `backend/app/services/payroll/` as typed Python with **unit tests for every edge case** (PRD §11: "Payroll for a 20-teacher center calculates correctly for 50 test scenarios"). The frontend module orchestrates UI + Server Actions that call the engine via FastAPI.

## Build checklist

- [ ] Payroll calculation engine (Python service, fully unit-tested)
- [ ] Period selector → table of all teachers with calculated salary
- [ ] Per-teacher breakdown view (sessions, hours, rate, adjustments)
- [ ] Manual override on final_amount **with reason** (audit log)
- [ ] Approve & lock → no further changes
- [ ] Mark as Paid on date
- [ ] **Excel export matching Vietnamese accounting conventions**
- [ ] Audit log table (who changed what, when)

## API (PRD App B)

```
GET    /api/v1/centers/:id/payroll-periods
POST   /api/v1/centers/:id/payroll-periods
GET    /api/v1/payroll-periods/:id
POST   /api/v1/payroll-periods/:id/approve
GET    /api/v1/payroll-periods/:id/export
```

## Acceptance criteria (PRD §5.8, §11)

- Calculation matches manual Excel for **100% of test cases** — no merging without unit-test coverage.
- Export Excel matches Vietnamese accounting conventions (column names, currency format `1.000.000đ`, signed totals).
- Audit log on every change to approved/locked periods.
- Currency math: **integer đồng (VND) throughout**. Never use floats.

## Worked example (PRD Appendix A)

Cô Linh, HOURLY @ 250,000 VND. Oct 2026: 30 of 32 sessions COMPLETED, 44.5 actual hours, +500,000 bonus, −100,000 deduction.

```
Hours pay   = 44.5 × 250,000 = 11,125,000 VND
Bonuses     =                    +500,000 VND
Deductions  =                    −100,000 VND
Final       =                 11,525,000 VND
```

A test fixture should encode this exactly.
