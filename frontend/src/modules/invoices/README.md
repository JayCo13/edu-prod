# `modules/invoices/`

**Status:** BUILD (P1) — Phase 4.
**PRD:** [§5.9 Tuition / Invoice](../../../../PRD.md#59-tuition--invoice-p1).

## Entities (PRD §6)

- `tuition_plans` — `center_id`, `name`, `type` (`MONTHLY | PER_SESSION | PER_COURSE | CUSTOM`), `amount` (integer VND), `details` (JSONB).
- `invoices` — `center_id`, `student_id`, `tuition_plan_id`, `period_start`, `period_end`, `amount`, `status` (`PENDING | PAID | OVERDUE | CANCELLED`), `due_date`, `paid_at`, `payment_method`.

## Build checklist

- [ ] Tuition plan CRUD
- [ ] Auto-generate invoices at start of each billing period
- [ ] Invoice list + filter by status
- [ ] Email/Zalo invoice link to parent
- [ ] Mark as paid (manual) — payment gateway integration deferred to v1.5
- [ ] Overdue marker (cron-driven, +7 day reminder per PRD §5.11)

## Payment gateway

**Deferred to v1.5** (PRD §5.9). Open question #1 (PRD §12): Stripe vs OnePay/VNPay — do not implement either until the founder decides.

For v1, manual "mark as paid" with optional `payment_method` text is acceptable.

## Notes

- Currency math: integer đồng. Never float.
- One invoice per (student, tuition_plan, period). De-dupe on generation.
- Reminder cadence: +1 day before due, +1 day overdue, +7 days overdue (PRD §5.11).
