# `modules/centers/`

**Status:** Implemented (P0 — Cycle 1). Coexists with the legacy `tenants` table; vocabulary rename is Cycle 2.
**PRD:** [§5.2 Center Settings](../../../../PRD.md#52-center-settings), [§6 data model](../../../../PRD.md#6-data-model-core-tables).

A **center (trung tâm)** is the customer org. Owns teachers, students, classes, sessions, invoices.

## Entities

- **`centers`** — name, address, phone, logo_url, timezone (`Asia/Ho_Chi_Minh` default), currency (VND, locked in v1), `settings` JSONB (business_hours, default_class_duration, notes...), subscription plan + status.
- **`user_centers`** — many-to-many (user_id, center_id, role_in_center, status). One user can belong to multiple centers (PRD §2.2 — teachers commonly do).

Schema: [`backend/supabase/migrations/0013_create_centers.sql`](../../../../backend/supabase/migrations/0013_create_centers.sql).

## Module layout

```
modules/centers/
├── types.ts                 — CenterRow, UserCenterRow, CenterSettings, enums, CentersResult<T>
├── schemas.ts               — Zod with Vietnamese validation messages
├── repository.ts            — Direct Supabase queries (server-only, no auth)
├── service.ts               — Business logic + auth + uniform Result envelope
├── actions.ts               — "use server" wrappers (UI invocation) — revalidate /admin/settings
├── components/
│   └── SettingsForm.tsx     — Client form (RHF-free; minimal state)
└── README.md
```

Authorization is layered: the service layer checks role; the DB enforces it again via RLS (defense in depth).

## HTTP API

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/api/v1/centers` | [route.ts](../../app/api/v1/centers/route.ts) | List centers caller belongs to |
| POST | `/api/v1/centers` | [route.ts](../../app/api/v1/centers/route.ts) | Create — caller becomes CENTER_ADMIN |
| GET | `/api/v1/centers/:id` | [[id]/route.ts](../../app/api/v1/centers/[id]/route.ts) | 404 for non-members via RLS |
| PATCH | `/api/v1/centers/:id` | [[id]/route.ts](../../app/api/v1/centers/[id]/route.ts) | 403 if not CENTER_ADMIN |

## resolveCenterId()

[`lib/auth/resolveCenterId.ts`](../../lib/auth/resolveCenterId.ts) — request-scoped helper. Resolves the authenticated user's active center via `user_centers`. Accepts `centerId`, `X-Center-Id` header, or falls back to the oldest active membership. Optional `requireRole` gate for CENTER_ADMIN-only ops.

Returns a discriminated union (`{ok:true,...} | {ok:false, reason: ...}`) so callers branch cleanly between UNAUTHENTICATED / NO_CENTER / FORBIDDEN_CENTER and render localized Vietnamese errors.

## RLS policies

Defined in the migration:
- `centers: member read` — `is_center_member(id)`
- `centers: authenticated insert` — open; service layer pairs it with the user_centers insert
- `centers: admin update` — `is_center_admin(id)`
- No DELETE policy (cancelled, not hard-deleted)
- `user_centers: self read`, `admin read center`, `self insert`, `admin insert/update/delete`

Helper functions (`is_center_member`, `is_center_admin`) are `SECURITY DEFINER` to avoid RLS recursion when policies query the membership table.

## UI

`/admin/settings` ([page](../../app/admin/settings/page.tsx)) shows the current center's settings. CENTER_ADMIN sees the editable form; CENTER_STAFF / TEACHER see read-only with a banner.

The `/admin/*` URL space is a sibling of legacy `(admin)/dashboard/*` — both layouts coexist until Cycle 2.

## Coexistence with legacy `tenants`

- `centers` is a brand-new table; nothing in this commit modifies `tenants`.
- Legacy code (calendar, live-sessions) still reads `tenants`, `tenant_teachers`, `live_sessions`. Untouched on purpose.
- Cycle 2 will migrate rows + rename references.

## Tests

[`backend/tests/test_centers_rls.py`](../../../../backend/tests/test_centers_rls.py) — pytest integration test exercising CRUD + cross-center RLS isolation against a real Supabase project. Skips if env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are unset.

```bash
cd backend && .venv/bin/pytest tests/test_centers_rls.py -v
```

## Conventions

- All UI strings Vietnamese (CLAUDE.md §8.3).
- Currency display: `1.000.000đ` (PRD §7.2). Currency math: integer đồng (no money fields in centers yet — pattern set for downstream modules).
- Date format DD/MM/YYYY.
- Search must be diacritic-insensitive when added.

## Not in this commit

- SUPER_ADMIN role + cross-center super-admin bypass — TBD.
- Atomic create-center+membership via Postgres RPC (currently manual rollback in service.ts).
- Multi-center selector in the UI (resolveCenterId picks oldest active membership as fallback).
- Subscription / billing UI (PRD §1.3 — Phase 4).
