# `modules/centers/`

**Status:** REFACTOR — replaces the `tenants` concept.
**PRD:** [§5.2 Center Settings](../../../../PRD.md#52-center-settings), [§6 data model](../../../../PRD.md#6-data-model-core-tables).

A **center (trung tâm)** is the customer org. Owns teachers, students, classes, sessions, invoices.

## Entities (PRD §6)

- `centers` — name, address, phone, logo, timezone (default `Asia/Ho_Chi_Minh`), currency (locked VND v1), `settings` JSONB (business_hours, default_class_duration, payroll_rules), `subscription_plan`, `subscription_status`.
- `user_centers` — many-to-many for users who work at multiple centers; carries `role_in_center` (`CENTER_ADMIN | CENTER_STAFF | TEACHER`) and `status` (`ACTIVE | INACTIVE | INVITED`).

## Migration from `tenants`

The current `tenants` table fills part of this role. A future migration renames `tenants` → `centers` (or copies + redirects); until then, treat `tenants.id` as `center_id`. Single owner becomes `user_centers.role_in_center = 'CENTER_ADMIN'`.

## Key flows

- Center signup → onboarding wizard (PRD §3.5, §10 Phase 3)
- Center settings page (logo, timezone, payroll rules, business hours)
- Subscription plan + billing (Phase 4)

## API (PRD App B)

```
GET    /api/v1/centers/:id
PATCH  /api/v1/centers/:id/settings
```

## Notes

- Every domain row MUST have `center_id`; every query filters by it. RLS enforces (PRD §5.1).
- Don't add subdomain-specific features here pending PRD open question #5.
