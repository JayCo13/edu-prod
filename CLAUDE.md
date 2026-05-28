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

Single-app monorepo (Supabase-only architecture):

- `frontend/` — Next.js 16 (App Router, Turbopack, React 19, Tailwind v4). All server logic lives in **Server Actions** + Next.js **Route Handlers**; no separate API server. Registered as `@vlearning/frontend` in the pnpm workspace.
- `backend/supabase/migrations/` — Numbered SQL migrations for the Supabase Postgres schema. Apply via `pnpm db:push` (or paste into Supabase Dashboard SQL Editor). RLS is enabled on every table.
- `backend/supabase/already/` — Snapshots of already-applied schema (reference only, not pending migrations).
- `PRD.md` — Product requirements. Source of truth for product direction.

> The earlier FastAPI + Celery + Redis backend was removed once all CRUD shifted to Server Actions and email moved to Gmail SMTP via nodemailer. The only thing left under `backend/` is the Supabase schema.

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

From repo root:

```bash
pnpm dev                     # next dev --turbopack on :3000
pnpm build                   # next build
pnpm lint                    # eslint
pnpm typecheck               # tsc --noEmit
pnpm db:push                 # apply any pending backend/supabase/migrations/*.sql
pnpm db:push:dry             # list pending migrations without applying
```

`db:push` reads `SUPABASE_DB_URL` from `backend/.env.local` (Supabase Dashboard → Settings → Database → Connection string → "Transaction" pooler URI; paste with your DB password). Pending migrations are detected against `public._schema_migrations`, applied in lexicographic order, each in its own transaction.

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

### 7.3 Data access

Single path: **Frontend → Supabase directly** via `@supabase/ssr` (Server Actions, Server Components, Client Components, Route Handlers). RLS policies in `backend/supabase/migrations/*.sql` enforce auth and tenant isolation. No separate API server.

For compute-heavy work (payroll calculation per PRD §5.8), the engine lives in `frontend/src/modules/payroll/` as pure TypeScript with unit tests. Server Actions orchestrate; Route Handlers expose downloadable artifacts (e.g. Excel/PDF export at `/api/v1/payroll-periods/[id]/export`).

### 7.4 External services

- **Supabase** (Postgres + Auth + Storage). Schema in `backend/supabase/migrations/`. Apply migrations in numeric order via `pnpm db:push`. New migrations: next `NNNN_description.sql`. Files in `backend/supabase/already/` are already-applied snapshots, not pending migrations.
  - **Admin auth APIs** (e.g. `auth.admin.createUser`, `inviteUserByEmail`, `updateUserById`, `listUsers`) require `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Only call from server actions / route handlers via `createAdminClient()` in `lib/supabase/admin.ts` — never from a Client Component.
- **Bunny Stream** for video hosting. Server-only helpers in `frontend/src/lib/bunny/stream.ts`. **Deprecated for v1** since LMS is out of scope — don't add features here.
- **Email — Gmail SMTP via nodemailer** (`frontend/src/lib/email/sender.ts`, templates in `frontend/src/emails/`). Env: `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (587 STARTTLS / 465 SSL), `SMTP_USER`, `SMTP_PASSWORD` (16-char Google App Password — requires 2FA on the account), `SMTP_FROM`. Free Gmail caps ~500 recipients/day; Workspace ~2000.
- **Live meetings (BYOM):** platform does **not** host video calls. Sessions store a `meeting_url` (Zoom/Meet/Teams/Jitsi); provider is auto-detected from hostname (`frontend/src/lib/meeting-provider.ts`). Do not add server-side meeting creation.

### 7.5 Teacher onboarding flow

Admins add teachers from `/dashboard/teachers` (no sidebar quick-action — each page owns its own trigger). The create dialog collects email + a temp password and calls `createTenantTeacher` (`app/actions/tenant-teachers.ts`), which:

1. Looks up the email in `auth.users`. If it exists, links to that user (cross-center re-add).
2. Otherwise creates the auth account directly via `admin.auth.admin.createUser({ email, password, email_confirm: true })` and stamps `user_metadata`:
   - `must_change_password: true`
   - `password_change_deadline: now + 24h` (ISO)
3. Inserts the `tenant_teachers` row with `profile_id` already linked (no waiting for a magic-link callback).
4. Sends a branded credentials email via `sendWhiteLabelEmail` containing the email + plaintext temp password + a 24h CTA pointing at `/auth/change-password`. Email failure is **non-blocking** (returned as `result.warning`); the account still exists, admin can share creds manually.

The teacher visits `/auth/change-password` to set their own password. The page + the `changePasswordAction` (`app/auth/change-password/actions.ts`) both check the deadline — once `must_change_password === true` AND `password_change_deadline < now`, self-service is locked and the admin must reset. On the first successful change, both flags are cleared so future changes are unrestricted.

The earlier magic-link invite path (`auth.admin.inviteUserByEmail` + `/auth/setup` route) is no longer wired up for teacher creation. `/auth/setup` still exists for any other invite flows but isn't reached from `createTenantTeacher`.

## 8. Conventions

### 8.1 Code

- **TypeScript strict mode** on frontend.
- **Server logic:** Server Actions for mutations + Next.js Route Handlers for files / streaming responses. No separate API server, no tRPC, no GraphQL.
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

- New migrations: use the next `NNNN_description.sql` number; do not edit applied migrations. Always apply via `pnpm db:push` (or the Dashboard SQL Editor) — the file alone doesn't take effect.
- The product is Vietnamese-first. When adding copy, **don't translate literally from English** — use natural Vietnamese phrasing.
- Payroll is the killer feature and must match a manual Excel calculation for 100% of test cases (PRD §5.8). Treat the calculation engine as untouchable without unit tests.
- "Tenant" still appears in code (table names, helper names like `getCurrentTenantContext`). Don't blanket-rename until a migration lands — but in new code prefer "center" vocabulary.
- The earlier Python/FastAPI/Celery backend was removed (everything runs through Supabase + Server Actions now). If you find old references to `lib/api-client.ts`, `backend/app/`, `docker:up`, or `dev:backend`, they're stale — delete or update them.
