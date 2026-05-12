# `modules/teachers/`

**Status:** EXPAND — basic teacher CRUD exists in `app/actions/tenant-teachers.ts`; this module is the target for the full lifecycle.
**PRD:** [§5.3 Teacher Management](../../../../PRD.md#53-teacher-management), [§8.4 refactor instructions](../../../../PRD.md#84-teacher-management-existing).

## Entity (PRD §6 `teachers`)

1:1 with `users` where `role = TEACHER`. Belongs to a `center_id` (and may belong to multiple via `user_centers`).

Fields: `user_id` (PK/FK), `center_id`, `hourly_rate` (VND integer), `payment_structure` (`HOURLY | PER_SESSION | FIXED_MONTHLY | HYBRID`), `fixed_monthly_amount` (nullable), `per_session_rate` (nullable), `tags` (text[]), `notes` (admin-only), `status` (`ACTIVE | INACTIVE | INVITED`).

## Refactor checklist (PRD §8.4)

- [ ] Add invite flow — generate magic link, send via SMS/Zalo
- [ ] Add hourly rate + payment structure fields to teacher form
- [ ] Teaching history view (sessions taught)
- [ ] Earnings history view (links to `payroll_items`)
- [ ] Deactivate (preserves history, removes from scheduling)
- [ ] Tags (`IELTS`, `Native speaker`, `Kids specialist`, ...)

## Migration from `tenant_teachers`

Existing `tenant_teachers` "slot" model (see migration `0012_multi_teacher_calendar.sql`) becomes the source of truth for who teaches at a center. Keep slot-based scheduling primitives during transition; new fields (rate, payment_structure) get added via migration.

## API (PRD App B)

```
GET    /api/v1/centers/:id/teachers
POST   /api/v1/centers/:id/teachers
PATCH  /api/v1/teachers/:id
POST   /api/v1/teachers/:id/invite
GET    /api/v1/teachers/:id/earnings
```

## Notes

- Currency is integer đồng (VND), never float.
- Invite via magic link first; password setup happens after acceptance (PRD §3.5).
- Hide the public teacher directory (`/teachers`, `components/marketplace/`, `components/profile/`) — teachers don't have public profiles in this product (PRD §4.3).
