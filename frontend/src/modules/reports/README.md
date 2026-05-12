# `modules/reports/`

**Status:** BUILD (P1) — Phase 3 basic, Phase 4 refine.
**PRD:** [§5.10 Reports](../../../../PRD.md#510-reports-p1).

## Minimum viable reports (PRD §5.10)

1. **Monthly summary** — total revenue, total payroll, profit (center-wide).
2. **Teacher utilization** — hours taught vs available.
3. **Class profitability** — revenue per class − teacher cost.
4. **Student attendance** — ranked by attendance %.
5. **Tuition collection rate** — % of invoices paid on time.

All exportable to Excel.

## Build checklist

- [ ] Monthly summary (revenue, payroll, profit) — derived from `payroll_periods` + `invoices`
- [ ] Teacher utilization view
- [ ] Class profitability view
- [ ] Student attendance leaderboard
- [ ] Tuition collection rate %
- [ ] Excel export for each report

## Notes

- These are **derived** views — no new tables. Reads from `sessions`, `attendance`, `payroll_items`, `invoices`.
- Performance: pre-aggregate via SQL views or materialized views if a center has 500+ students.
- Currency display: `1.000.000đ` (PRD §7.2).
- Date filtering uses center's timezone.
- Avoid AI/recommendation features here — out of scope per PRD §1.4.
