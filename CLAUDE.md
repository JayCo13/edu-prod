# CLAUDE.md

Guidance for Claude Code working in this repository.

> **Single source of truth: [`PRD.md`](./PRD.md)** at the repo root. Read it before non-trivial work. If a request conflicts with the PRD, flag it before coding. This file describes the *code*; the PRD describes the *product*.

## 1. Product direction (read this first)

This is a **B2B SaaS for Vietnamese education centers (trung tâm)** — scheduling, attendance, and payroll. The killer feature is **payroll calculation** (PRD §5.8). Pricing is per-active-teacher monthly subscription (PRD §1.3).

**The product was repositioned** from an earlier "white-label EdTech for individual teachers" direction. Significant existing code reflects the old direction and is being refactored or hidden — see §4 below.

**Out of scope for v1** (PRD §1.4): whiteboard, video conferencing, LMS features, student-facing content, **multi-tenant white-label**, AI features, public API, marketplace. Don't build toward these.

**Multi-tenant clarification:**
- Multi-tenant **white-label subdomains** → out of scope. PRD open question #5 is undecided; do not regress.
- Multi-tenant **data isolation** (every row has `center_id`, RLS enforced) → required. See PRD §5.1.

## 2. Repository Layout

Monorepo with two independently-runnable apps:

- `frontend/` — Next.js 16 (App Router, Turbopack, React 19, Tailwind v4). Registered as `@vlearning/frontend` in the pnpm workspace (`pnpm-workspace.yaml`). The workspace currently only contains `frontend`; the backend is **not** a pnpm package.
- `backend/` — FastAPI + Celery + Redis, Python ≥3.11 (Dockerfile uses 3.13-slim). Dependencies are managed both via `pyproject.toml` (PEP 621) and a pinned `requirements.txt` — Docker installs from `requirements.txt`.
- `backend/supabase/migrations/` — Numbered SQL migrations for the Supabase Postgres schema. Run via Supabase Dashboard SQL Editor or `supabase db push`. RLS is enabled on every table.
- `PRD.md` — Product requirements. Source of truth for product direction.

## 3. Target code structure (new work goes here)

New domain code lives under `frontend/src/modules/<name>/` per PRD §9.3. Each module is self-contained (components, hooks, server actions, types, optionally a `README.md` for purpose/status).

```
frontend/src/modules/
  centers/      — center settings, multi-center membership (was: tenants)
  teachers/     — teacher CRUD, rates, invite flow, earnings history
  students/     — student CRUD, parent contacts, bulk Excel import
  classes/      — recurring class templates + enrollment
  sessions/     — class instances, scheduling, conflict detection
  attendance/   — teacher check-in/out, per-student status
  payroll/      — calculation engine, periods, approval, Excel export  [KILLER]
  invoices/     — tuition plans, invoice generation, payment marking
  reports/      — monthly summary, utilization, profitability, attendance %
```

Each module folder has a `README.md` summarizing PRD scope and current status (BUILD/REFACTOR/HIDE). Auth/multi-tenant isolation primitives stay in `frontend/src/lib/supabase/` and the Edge middleware — they cut across modules.

**Existing code coexists** during the refactor:
- `frontend/src/app/actions/` — Server Actions (auth, courses, curriculum, live-sessions, profile, public, student, tenant-teachers). Continues to work; new actions go in `modules/<name>/actions.ts` instead of this folder. Migrate file-by-file as features are touched, not in one big sweep.
- `frontend/src/components/{admin,landing,profile,marketplace,shared,calendar,ui}/` — UI components. `admin/` (shell, sidebar) is shared chrome and stays. `marketplace/`, `profile/` (public teacher pages) are deprecated UI (see §4). `landing/` is being rewritten per PRD §8.1.
- `frontend/src/app/(public)/`, `(admin)/`, `t/[slug]/` — App Router routes. Stay where they are; we may collapse `t/[slug]/` if the subdomain decision lands on shared-domain.

## 4. Refactor / deprecation status (PRD §4, §8)

Hide from UI/routes, **do not delete** the code yet (we may revive):

| Area | Status | Notes |
|---|---|---|
| Landing page (teacher-targeted) | **REWRITE** | Target center owners. CTA = "Đặt lịch demo 15 phút". See PRD §8.1. |
| `/dashboard` single view | **REFACTOR** | Split into `AdminDashboard` vs `TeacherDashboard` by role. PRD §8.2. |
| Schedule / calendar | **REFACTOR → EXPAND** | Multi-teacher, multi-class, drag-drop, conflict detection. PRD §8.3. |
| Teacher management | **EXPAND** | Add rates, payment structure, invite flow, earnings history. PRD §8.4. |
| Meeting scheduler (online) | **KEEP, integrate** | Becomes `sessions.online_meeting_url`. BYOM only — never host meetings. PRD §8.5. |
| Whiteboard | **HIDE** if present | PRD §4.3. |
| Individual teacher signup | **HIDE** | Teachers only join via center invite. PRD §4.3. |
| Public teacher directory (`/teachers`, `components/marketplace/`, `components/profile/`) | **HIDE** | PRD §4.3. |
| Student-facing learning content (`t/[slug]/learn`, courses curriculum/lessons) | **HIDE** | PRD §1.4 — LMS out of scope. |
| Courses module (`actions/courses.ts`, `actions/curriculum.ts`, `app/(admin)/dashboard/courses`) | **DEPRECATE** | Domain doesn't map to centers. Don't extend; new equivalent is `modules/classes/`. |

When you hide something, remove it from routes/UI/navigation but leave the source files. Add a brief note at the top of the file: `// HIDDEN per PRD §4.3 (date). Do not delete; see PRD non-goals.` if not already obvious from this table.

## 5. Domain mapping (old code → PRD vocabulary)

The existing schema uses earlier vocabulary. Mapping:

| Existing | Target (PRD) | Notes |
|---|---|---|
| `tenants` table | `centers` | Rename in a future migration. Until migrated, treat `tenants.id` as `center_id`. |
| `tenants.owner_id` | `centers` admin via `user_centers.role_in_center='CENTER_ADMIN'` | Multi-admin per center is target. |
| `tenant_teachers` | `teachers` (1:1 with users) + `user_centers` for multi-center | PRD §6 data model. |
| `live_sessions` | `sessions` | New `sessions` includes class link, attendance link, check-in/out. |
| `courses` / `modules` / `lessons` / `lesson_progress` | (deprecated) | Out of scope for v1. Keep tables but don't extend. New equivalent is `classes` + `sessions`. |
| Subdomain rewrite `/t/[slug]/...` | TBD (open question #5) | Don't add new tenant-subdomain features; the strategy may change. |

The `IGNORED_SUBDOMAINS` set and subdomain regex in `lib/supabase/middleware.ts` (Edge-inlined) and `lib/tenant-context.ts` are still duplicated — keep in sync until the subdomain decision lands.

## 6. Common Commands

From repo root (uses pnpm workspaces / a local `.venv` at `backend/.venv`):

```bash
pnpm dev:frontend            # next dev --turbopack on :3000
pnpm dev:backend             # uvicorn app.main:app --reload --port 8000
pnpm build:frontend          # next build
pnpm lint:frontend           # eslint
pnpm typecheck:frontend      # tsc --noEmit
pnpm docker:up               # docker compose up --build (api + redis + worker)
pnpm docker:down
```

Backend tests (from `backend/`, with `.venv` activated):

```bash
.venv/bin/pytest                                    # all tests
.venv/bin/pytest tests/test_users.py                # single file
.venv/bin/pytest tests/test_users.py::test_name     # single test
```

`pyproject.toml` configures `asyncio_mode = "auto"` and `testpaths = ["tests"]`. Lint/type tools: `ruff` (line-length 100, rules `E,W,F,I,N,UP,B,SIM`) and `mypy --strict`.

Celery worker (local, outside Docker):

```bash
cd backend && .venv/bin/celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
```

The `worker` Compose service runs the same command. The `emails` queue is routed explicitly in `app/worker/celery_app.py`; new task routes go in the same `task_routes` dict.

## 7. Architecture

### 7.1 Tenant/center detection (Edge middleware)

Tenant detection lives in `frontend/src/lib/supabase/middleware.ts` (invoked from `src/middleware.ts`). It parses the `Host` header, ignores reserved subdomains (`www, app, api, admin, mail, localhost`), and:
1. Sets `x-tenant-slug` header on the request.
2. **Rewrites** subdomain requests to `/t/[slug]/...` so Next.js routes them under `src/app/t/[slug]/`.
3. Refreshes the Supabase session and scopes auth cookies to the root domain so a session at root works on every subdomain (cross-domain SSO).

The same logic is duplicated in `frontend/src/lib/tenant-context.ts` for non-Edge contexts (Server Components, Server Actions). The Edge middleware version inlines its helpers because Edge Runtime can't import Node-style modules.

Route protection (redirect `/dashboard` → `/login` if unauthenticated; redirect `/login` → `/dashboard` if authenticated) is **only** applied on the root domain — subdomain routes have their own auth.

`getCookieDomain()` in `lib/supabase/cookie-domain.ts` returns `undefined` for `localhost` (browsers refuse domain-scoped localhost cookies), and `.<root-domain>` otherwise. Both `lib/supabase/server.ts` and the middleware honor this.

> Per PRD open question #5, subdomain strategy is undecided. Don't expand `t/[slug]/` routes; new center-scoped features should be reachable via a shared-domain pattern (e.g., a center selector or path-scoped `/c/<slug>/`) once decided.

### 7.2 Frontend routes today

`src/app/` uses route groups to share layouts without affecting URLs:

- `(public)/` — marketplace + auth pages (`/login`, `/register`, `/courses`, `/teachers`, ...). `/teachers` and `/courses` are deprecated (PRD §4.3).
- `(admin)/dashboard/` — teacher's tenant admin (root domain, gated by middleware). Will split into role-based dashboards per PRD §8.2.
- `t/[slug]/` — pages reached via the middleware subdomain rewrite. Frozen pending PRD open question #5.
- `actions/` — `"use server"` Server Actions. New mutations should live in `modules/<name>/actions.ts` instead.

### 7.3 Data access split

There are **two separate paths** to the database, and they coexist:

1. **Frontend → Supabase directly** (Server Actions / Server Components / Client Components via `@supabase/ssr`). Dominant path. RLS policies in `backend/supabase/migrations/*.sql` enforce auth.
2. **Frontend → FastAPI → Supabase** via `lib/api-client.ts` (axios, Bearer token from `access_token` cookie). The backend currently exposes only `/api/v1/users`. The api-client has a `TODO` to migrate from manual cookies to `@supabase/ssr` session reading. Don't assume new features need a FastAPI endpoint — most CRUD goes through Server Actions.

For payroll specifically, the calculation engine should live in `backend/app/services/payroll/` and be reachable from the frontend via a FastAPI endpoint (it's pure computation that benefits from a typed Python service with unit tests). UI orchestration stays in Server Actions.

### 7.4 Backend layout (`backend/app/`)

- `main.py` — FastAPI factory with lifespan that opens/closes the Redis pool. Health check at `/health`. Docs at `/docs` (only when `DEBUG=true`).
- `core/` — `config.py` (pydantic-settings, env-driven; comma-separated `CORS_ORIGINS` parsed by `cors_origins_list`), `redis.py` (singleton `redis_manager`), `supabase.py`, `dependencies.py`.
- `api/v1/router.py` aggregates `endpoints/*.py` routers. Add new endpoint modules and register them here.
- `services/` — Domain services. When adding third-party integrations, prefer an ABC interface ("port") + concrete adapter so the rest of the app depends on the interface, not the vendor.
- `worker/` — Celery app + tasks. Broker/backend default to Redis DBs 0/1.
- `models/` — Pydantic models (not ORM — Supabase is the source of truth for schema).

### 7.5 External services

- **Supabase** (Postgres + Auth + Storage). Schema in `backend/supabase/migrations/`. Apply migrations in numeric order. New migrations: next `NNNN_description.sql`. Files in `backend/supabase/already/` are already-applied snapshots, not pending migrations.
- **Bunny Stream** for video hosting. Server-only helpers in `frontend/src/lib/bunny/stream.ts`. **Deprecated for v1** since LMS is out of scope — don't add features here.
- **Resend** for transactional email (`frontend/src/lib/email/sender.ts`, `frontend/src/emails/`). Backend has its own `email_service.py` for Celery-driven sends.
- **Live meetings (BYOM):** platform does **not** host video calls. Sessions store a `meeting_url` (Zoom/Meet/Teams/Jitsi); provider is auto-detected from hostname (`frontend/src/lib/meeting-provider.ts`). Do not add server-side meeting creation.

## 8. Conventions

### 8.1 Code

- **TypeScript strict mode** on frontend.
- **API style:** RESTful (FastAPI) or Server Actions. No tRPC, no GraphQL.
- **State:** Server state via React Query (`lib/query-provider.tsx`); client state via React Context or component-local.
- **Forms:** React Hook Form + Zod.
- **Dates:** `date-fns` or `dayjs`. Never `moment.js`.
- **Currency math:** Integers in đồng (VND). **Never floats.** All arithmetic on `bigint` or integer columns.
- **Testing:** Unit tests for payroll calculation are **required** before merging — 100% Excel-parity (PRD §5.8 acceptance criteria).

### 8.2 Naming

- Database: `snake_case`. UUID PKs (`gen_random_uuid()`), `created_at/updated_at` with auto-update triggers, RLS enabled on every table.
- TypeScript: `camelCase` for vars, `PascalCase` for types/components.
- API endpoints: `/api/v1/<plural-noun>` (PRD Appendix B for the canonical list).
- **Vietnamese in UI**, English in code. User-facing copy (validation messages, default names) is in Vietnamese — match existing tone.

### 8.3 Vietnamese UX rules (PRD §7.2)

- Date format: `DD/MM/YYYY`
- Currency: `1.000.000đ` (dot separator, `đ` suffix, no space)
- Phone: `0901 234 567` (no `+84` in UI)
- Time: 24-hour
- Names: UTF-8, support diacritics
- Search: **diacritic-insensitive** ("nguyen" matches "Nguyễn")

### 8.4 Mobile-first for teachers (PRD §7.3)

Teacher views (attendance, today's schedule) are used on phones in noisy classrooms. Bottom navigation, 44px+ tap targets, page load <2s on 3G, offline-capable attendance queue where feasible.

## 9. Roadmap snapshot (PRD §10)

- **Phase 1 (current):** Refactor — hide deprecated features, rewrite landing for center owners, split dashboard by role, ensure `center_id` everywhere, RBAC.
- **Phase 2:** Payroll MVP — students, classes, attendance, **payroll engine + Excel export**.
- **Phase 3:** Pilot onboarding — Excel bulk import, onboarding wizard, basic reports.
- **Phase 4:** Tuition/invoicing, Zalo reminders, mobile polish.

When unsure if something belongs in this sprint, check the phase. If it's a Phase 3 feature and we're in Phase 1, surface the question.

## 10. Things that bite

- The `package.json` `dev` script aliases to `dev:frontend` only — running both apps requires two terminals (or `docker:up` for the backend stack). The `package.json description` field still says "White-label EdTech" — leftover from before the pivot; harmless.
- New migrations: use the next `NNNN_description.sql` number; do not edit applied migrations. The `0012_multi_teacher_calendar.sql` schema is the current baseline for tenant teachers; the centers/classes/sessions/attendance/payroll tables (PRD §6) are not yet migrated.
- The product is Vietnamese-first. When adding copy, **don't translate literally from English** — use natural Vietnamese phrasing.
- Payroll is the killer feature and must match a manual Excel calculation for 100% of test cases (PRD §5.8). Treat the calculation engine as untouchable without unit tests.
- "Tenant" still appears in code (table names, helper names like `getCurrentTenantContext`). Don't blanket-rename until a migration lands — but in new code prefer "center" vocabulary.
