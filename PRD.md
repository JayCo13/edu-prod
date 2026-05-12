# Product Requirements Document (PRD)
## Education Center Management Platform

**Version:** 1.0
**Last Updated:** 2026-05-12
**Status:** Draft / Pre-MVP
**Owner:** Solo Founder

---

> **AI Agent Instructions (Read First)**
>
> This document is the **single source of truth** for product direction. When refactoring or building features:
>
> 1. **Always align changes with this PRD.** If a feature request conflicts with this doc, flag it before coding.
> 2. **Refactor existing code to match Target State**, not what's already built.
> 3. **Hide/deprecate features marked `[DEPRECATE]` or `[HIDE]`** — do not delete code yet, just remove from UI/routes.
> 4. **New features marked `[BUILD]`** are priorities for the next sprint.
> 5. **Follow the data model exactly.** Migrations needed = ask first.
> 6. **Tech stack constraints in section 9** are non-negotiable for v1.
> 7. **Acceptance criteria in section 11** define "done" for MVP.

---

## 1. Product Overview

### 1.1 What we're building

A **SaaS web application** for **education centers (trung tâm)** in Vietnam to manage their day-to-day operations: scheduling classes, managing teachers, tracking student attendance, and calculating teacher payroll.

### 1.2 Why this exists

Education centers in Vietnam (English centers, tutoring centers, skill centers) currently manage operations through fragmented tools: Excel + Zalo + paper + Google Calendar. This causes:

- 5–15 hours/week wasted on admin work
- Payroll errors and disputes with teachers
- Missed classes due to scheduling conflicts
- No visibility into teacher utilization or center performance

**Our value proposition:** Cut admin time by 70% and eliminate payroll errors through a single integrated platform.

### 1.3 Business Model

**B2B SaaS** with monthly subscription based on number of active teachers.

| Tier | Teachers | Price/month (VND) |
|------|----------|-------------------|
| Starter | 1–5 | 300,000–500,000 |
| Growth | 6–20 | 1,000,000–1,500,000 |
| Pro | 21–50 | 2,500,000–4,000,000 |
| Enterprise | 50+ | Custom |

**Annual plan:** 20% discount.

### 1.4 Non-Goals (NOT building in v1)

The following are explicitly **out of scope** for v1 and should not be built or refactored toward:

- ❌ Whiteboard / drawing canvas for teaching
- ❌ Video conferencing (integrate with Zoom/Google Meet, don't build)
- ❌ Learning Management System features (assignments, quizzes, grading)
- ❌ Student-facing learning content
- ❌ Mobile native app (web responsive is enough for v1)
- ❌ Multi-tenant white-label
- ❌ AI features (auto-scheduling, recommendations)
- ❌ Public API for 3rd parties
- ❌ Marketplace / discovery of centers for students

If a feature doesn't directly reduce admin time for center owners, it doesn't belong in v1.

---

## 2. Target Users

### 2.1 Primary Persona: Center Owner / Admin (Decision Maker)

**Name:** Anh Tuấn
**Age:** 35–50
**Role:** Owner or operations manager of an English/tutoring center
**Center size:** 5–30 teachers, 100–500 students
**Tech literacy:** Medium. Uses Excel, Zalo, Facebook. Not a developer.

**Pain points:**
1. Spends Sunday evenings calculating teacher salaries in Excel (4–8 hours/month)
2. Conflicts between teachers over schedules
3. Forgetting to bill students for tuition
4. No clear view of which classes are profitable

**Goals:**
- Reduce admin work to focus on growing the business
- Eliminate payroll disputes
- Get clear monthly financial overview

**Decision criteria:**
- Does it calculate payroll correctly? (#1 question they ask)
- Can teachers actually use it without training?
- Is my data safe?
- How much does it cost vs hours saved?

### 2.2 Secondary Persona: Teacher (Daily User)

**Name:** Cô Linh
**Age:** 25–40
**Role:** English teacher at one or more centers
**Tech literacy:** Medium-high. Uses smartphone heavily, Google Calendar, Zalo.

**Pain points:**
1. Multiple schedules across centers, often conflicting
2. Lost track of how many hours taught → disputes over salary
3. Hard to track student progress across many students

**Goals:**
- See today's classes at a glance
- Mark attendance quickly (under 30 seconds per class)
- See how much they'll earn this month

**Decision criteria:**
- Mobile-friendly (they use phone, not laptop)
- Fast — no slow loading
- Doesn't require login every time

### 2.3 Tertiary Persona: Student/Parent (Read-Only)

**Out of scope for v1.** May get a read-only schedule view via shareable link in v1.5.

---

## 3. Core User Flows

### 3.1 Admin Daily Flow

1. Open dashboard → see today's classes, teachers on duty, classes at risk
2. Receive notification: teacher reported absent → reschedule or assign substitute
3. Review pending student payments → send Zalo reminder (one click)
4. End of day: review attendance reports

### 3.2 Admin Monthly Flow (Payroll)

1. Navigate to Payroll module
2. Select month → see auto-calculated salary per teacher
3. Adjust manually if needed (bonuses, deductions)
4. Approve → export Excel for accounting
5. Mark as paid when transfer is done

### 3.3 Teacher Daily Flow

1. Open app (mobile browser) → see today's schedule
2. 5 min before class: tap "Start Class" → check-in recorded
3. During class: tap students present/absent (one tap each)
4. End of class: tap "End Class" → tap optional note about session

### 3.4 New Student Onboarding Flow

1. Admin creates student profile (name, phone, parent contact)
2. Assign to a class
3. Set tuition plan (monthly / per session / per course)
4. System auto-generates invoice
5. Admin shares payment link via Zalo

### 3.5 New Teacher Onboarding Flow

1. Admin creates teacher profile
2. Set hourly rate and pay structure
3. Invite teacher via SMS/Zalo link
4. Teacher sets password, accesses mobile view

---

## 4. Feature Inventory

### 4.1 Current State (What's Built)

| Feature | Status | Action |
|---------|--------|--------|
| Landing page (teacher signup) | ✅ Built | **[REWRITE]** — target center owners, not teachers |
| Dashboard | ✅ Built | **[REFACTOR]** — split into Admin / Teacher views |
| Meeting scheduler (online) | ✅ Built | **[KEEP]** — integrate with class schedule |
| Schedule/Timetable | ✅ Built | **[EXPAND]** — multi-teacher, multi-class |
| Teacher management (B2B) | ✅ Built | **[KEEP & EXPAND]** — this is core USP |

### 4.2 Target State (Must Have for MVP)

| Module | Priority | Status |
|--------|----------|--------|
| Auth + multi-tenant (centers) | P0 | **[BUILD]** if not present |
| Center settings | P0 | **[BUILD]** |
| Teacher management | P0 | **[REFACTOR]** existing |
| Student management | P0 | **[BUILD]** |
| Class management | P0 | **[BUILD]** |
| Schedule/Timetable | P0 | **[REFACTOR]** existing |
| Attendance tracking | P0 | **[BUILD]** |
| Payroll calculation | P0 | **[BUILD]** — KILLER FEATURE |
| Tuition/Invoice | P1 | **[BUILD]** |
| Reports (basic) | P1 | **[BUILD]** |
| Notifications (Zalo/email) | P2 | **[BUILD]** |

### 4.3 Deprecated / Hidden Features

The following should be **hidden from UI but not deleted from codebase** (we may revive later):

- `[HIDE]` Whiteboard feature (if exists)
- `[HIDE]` Individual teacher signup flow (we only allow center-invited signups)
- `[HIDE]` Public teacher directory (if exists)
- `[HIDE]` Any student-facing learning content

---

## 5. Detailed Module Specifications

### 5.1 Auth & Multi-Tenant

**Roles:**
- `SUPER_ADMIN` — platform owner (you), can see all centers
- `CENTER_ADMIN` — owner/manager of a center, full access within center
- `CENTER_STAFF` — limited admin (e.g., receptionist), configurable permissions
- `TEACHER` — sees own schedule, attendance, payroll only

**Tenant isolation:**
- Every domain object MUST belong to a `center_id`
- All queries MUST filter by `center_id` of the authenticated user
- Use row-level security (RLS) if database supports it (Postgres + Supabase recommended)

**Login methods:**
- Email + password (default)
- Phone OTP (for teachers — most don't check email)
- Magic link via Zalo (v1.5)

### 5.2 Center Settings

Each center has:
- Name, address, phone, logo
- Timezone (default: Asia/Ho_Chi_Minh)
- Currency (VND, locked for v1)
- Business hours
- Default class duration (e.g., 90 min)
- Payroll rules (see Payroll section)
- Subscription plan + billing info

### 5.3 Teacher Management

**Fields:**
- Full name, phone, email (optional), avatar
- Hourly rate (VND) — default
- Override rates per class type (advanced)
- Payment structure: `HOURLY` | `PER_SESSION` | `FIXED_MONTHLY` | `HYBRID`
- Status: `ACTIVE` | `INACTIVE` | `INVITED`
- Notes (private, admin only)
- Tags (e.g., "IELTS", "Native speaker", "Kids specialist")

**Actions:**
- Invite (sends SMS/Zalo with magic link)
- Deactivate (preserves history, removes from active scheduling)
- View teaching history
- View earnings history

### 5.4 Student Management

**Fields:**
- Full name, phone (or parent phone), email (optional)
- Parent name + relationship (if minor)
- Date of birth, gender
- Level/grade
- Enrollment date
- Status: `ACTIVE` | `PAUSED` | `GRADUATED` | `DROPPED`
- Tuition plan reference
- Notes (visible to assigned teachers)
- Tags

**Bulk import:** Excel/CSV import for migrating from old system. Required for onboarding new centers.

### 5.5 Class Management

A **class** is a recurring group of students with one or more teachers.

**Fields:**
- Class name (e.g., "IELTS 7.0 - Evening")
- Class type/category (configurable per center)
- Assigned teacher(s)
- Enrolled students (many-to-many)
- Max capacity
- Schedule pattern (e.g., Mon/Wed/Fri 7–9pm)
- Start date, end date (optional)
- Default room/location
- Pricing reference

**Difference from "session":** A class is the recurring template. Each meeting is a **session** (instance of the class).

### 5.6 Schedule / Timetable

**Views:**
- **Week view (admin):** all classes across all teachers, color-coded
- **Day view (admin):** today's sessions with attendance status
- **My schedule (teacher):** only their assigned classes
- **List view:** filterable, exportable

**Session entity:**
- Belongs to a class
- Date + start time + end time
- Status: `SCHEDULED` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED` | `RESCHEDULED`
- Assigned teacher (may differ from class default if substitute)
- Room/location
- Online meeting link (optional)
- Notes

**Operations:**
- Create single session
- Bulk-create sessions from class schedule pattern (e.g., generate 3 months ahead)
- Reschedule (drag-drop in week view)
- Cancel (with reason)
- Assign substitute teacher

**Conflict detection:** When scheduling, warn if:
- Teacher already has a session at that time
- Room already booked
- Student is enrolled in another class at that time

### 5.7 Attendance Tracking

**Per session, track:**
- Teacher check-in time
- Teacher check-out time
- Each student: `PRESENT` | `ABSENT` | `LATE` | `EXCUSED`
- Per-student notes (optional)

**Teacher mobile UI:**
- Big "Start Class" button → records check-in
- List of enrolled students with tap-to-toggle status
- "End Class" button → records check-out + optional session note
- Should work on slow 3G connections (offline-first if possible)

**Reports:**
- Per-student attendance % over time
- Per-class attendance trends
- Teacher reliability (% of sessions started on time)

### 5.8 Payroll (KILLER FEATURE)

This is the **#1 reason centers will pay**. Build this with extreme care.

**Calculation logic:**

For each teacher in a billing period (default: month):

```
Total Pay =
  + (Hours taught × Hourly rate)  [if HOURLY]
  + (Sessions taught × Per-session rate)  [if PER_SESSION]
  + Fixed monthly salary  [if FIXED_MONTHLY]
  + Bonuses (manual)
  - Deductions (manual)
```

**Hours taught calculation:**
- Only count sessions with status = `COMPLETED`
- Hours = (check-out time − check-in time) capped at session duration × 1.1
- If no check-in/out recorded, use scheduled duration × completion factor

**Edge cases to handle:**
- Cancelled sessions: don't count
- Substituted sessions: pay goes to substitute, not original teacher
- Partial sessions: pro-rate
- Late check-in: configurable (some centers penalize, some don't)
- Multi-teacher session (co-teaching): split pay configurable

**Admin UI:**
- Select month → table of all teachers with calculated salary
- Click teacher → see breakdown (sessions, hours, rate, adjustments)
- Edit individual amount (with reason)
- Approve & lock → no more changes
- Export to Excel (with breakdown)
- Mark as "Paid on [date]"

**Acceptance criteria:**
- Calculation must match manual Excel calculation for 100% of test cases
- Export Excel matches Vietnamese accounting conventions
- Audit log: who changed what, when

### 5.9 Tuition / Invoice (P1)

**Tuition plans:**
- `MONTHLY` — fixed monthly fee
- `PER_SESSION` — pay per attended session
- `PER_COURSE` — pay for X sessions upfront
- `CUSTOM` — admin sets

**Invoice generation:**
- Auto-generate at start of each billing period
- Email/Zalo to parent
- Mark as paid (manual or via payment gateway in v1.5)

**Payment gateway integration:** Defer to v1.5. For v1, manual marking is acceptable.

### 5.10 Reports (P1)

Minimum viable reports:

1. **Monthly summary:** total revenue, total payroll, profit
2. **Teacher utilization:** hours taught vs available
3. **Class profitability:** revenue per class − teacher cost
4. **Student attendance:** ranked by attendance %
5. **Tuition collection rate:** % of invoices paid on time

Export all to Excel.

### 5.11 Notifications (P2)

**Channels:**
- In-app
- Email
- Zalo Official Account (requires setup — defer if complex)
- SMS (paid, last resort)

**Triggers:**
- Class starts in 30 min (to teacher)
- Student absent for 3+ consecutive sessions (to admin)
- Tuition overdue 7 days (to parent)
- Monthly payroll ready for review (to admin)

---

## 6. Data Model (Core Tables)

```
centers
  id (uuid, pk)
  name, address, phone, logo_url
  timezone, currency
  settings (jsonb) — business_hours, default_class_duration, etc.
  subscription_plan, subscription_status
  created_at, updated_at

users
  id (uuid, pk)
  email (unique nullable), phone (unique nullable)
  password_hash
  full_name, avatar_url
  role (enum: SUPER_ADMIN, CENTER_ADMIN, CENTER_STAFF, TEACHER)
  default_center_id (fk → centers) nullable
  created_at, updated_at

user_centers  (many-to-many for users who work at multiple centers)
  user_id (fk)
  center_id (fk)
  role_in_center (enum)
  status (ACTIVE, INACTIVE, INVITED)

teachers  (extends users, or 1:1 with users where role=TEACHER)
  user_id (fk, pk)
  center_id (fk)
  hourly_rate (decimal)
  payment_structure (enum: HOURLY, PER_SESSION, FIXED_MONTHLY, HYBRID)
  fixed_monthly_amount (decimal, nullable)
  per_session_rate (decimal, nullable)
  tags (text[])
  notes (text)
  status

students
  id (uuid, pk)
  center_id (fk)
  full_name, phone, email, dob, gender
  parent_name, parent_phone, parent_relationship
  level, enrollment_date
  status
  notes, tags
  created_at, updated_at

classes
  id (uuid, pk)
  center_id (fk)
  name, type
  max_capacity
  schedule_pattern (jsonb) — e.g., {"days": ["MON","WED","FRI"], "start": "19:00", "duration_min": 120}
  start_date, end_date
  default_room
  tuition_plan_id (fk, nullable)
  created_at, updated_at

class_teachers
  class_id (fk)
  teacher_id (fk)
  role (primary | assistant)

class_students
  class_id (fk)
  student_id (fk)
  enrolled_at, unenrolled_at

sessions
  id (uuid, pk)
  class_id (fk)
  date, start_time, end_time
  assigned_teacher_id (fk)
  status (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULED)
  room
  online_meeting_url
  teacher_checkin_at, teacher_checkout_at
  notes
  created_at, updated_at

attendance
  session_id (fk)
  student_id (fk)
  status (PRESENT, ABSENT, LATE, EXCUSED)
  notes
  marked_by (fk → users)
  marked_at

payroll_periods
  id (uuid, pk)
  center_id (fk)
  period_start, period_end
  status (DRAFT, APPROVED, PAID)
  approved_by, approved_at
  paid_at

payroll_items
  id (uuid, pk)
  payroll_period_id (fk)
  teacher_id (fk)
  calculated_amount (decimal)
  adjustments (jsonb) — array of {reason, amount}
  final_amount (decimal)
  notes

tuition_plans
  id (uuid, pk)
  center_id (fk)
  name
  type (MONTHLY, PER_SESSION, PER_COURSE, CUSTOM)
  amount (decimal)
  details (jsonb)

invoices
  id (uuid, pk)
  center_id (fk)
  student_id (fk)
  tuition_plan_id (fk)
  period_start, period_end
  amount (decimal)
  status (PENDING, PAID, OVERDUE, CANCELLED)
  due_date, paid_at
  payment_method
```

**Indexes (critical for performance):**
- `sessions(center_id, date)` — composite
- `attendance(session_id)`, `attendance(student_id, marked_at)`
- `payroll_items(payroll_period_id, teacher_id)`

---

## 7. UI / UX Requirements

### 7.1 Design Principles

1. **Admin desktop, teacher mobile.** Admin uses laptop with big screen. Teacher uses phone in noisy classroom. Design accordingly.
2. **Vietnamese first.** All copy in Vietnamese. Use natural language, not literal translation from English.
3. **Speed over polish.** Page load under 2s on 3G. Animations minimal.
4. **Forgiving of mistakes.** Confirm destructive actions. Undo where possible. No data loss.
5. **Familiar patterns.** Use UI patterns from Google Calendar, Excel, Zalo — not flashy or novel.

### 7.2 Critical UX rules

- Date format: `DD/MM/YYYY` (Vietnamese standard)
- Currency: `1.000.000đ` (dot separator, đ suffix)
- Phone format: `0901 234 567` (Vietnamese standard, no +84 in UI)
- Time: 24-hour format
- Names: support Vietnamese diacritics (UTF-8 everywhere)
- Search: must be diacritic-insensitive (search "nguyen" matches "Nguyễn")

### 7.3 Mobile (Teacher) Specific

- Bottom navigation (not top — phones are big now)
- Large tap targets (44px minimum)
- Sticky "Start Class" button on schedule
- Offline-first for attendance (queue and sync when online)

---

## 8. Refactor Instructions for Existing Code

### 8.1 Landing Page

**Current:** Targets individual teachers.

**Target:** Targets center owners.

**Action:**
- Rewrite hero: "Quản lý trung tâm của bạn trong 1 phần mềm — Tiết kiệm 70% thời gian admin"
- CTA: "Đặt lịch demo 15 phút" (not "Sign up free")
- Replace teacher signup form with demo booking form
- Add social proof section (testimonials — placeholder until we have pilot customers)
- Add pricing table
- Add FAQ section

**Hide:**
- Direct teacher signup CTA (teachers only join via center invitation)

### 8.2 Dashboard

**Current:** Single dashboard.

**Target:** Two distinct dashboards based on role.

**Action:**
- Route `/dashboard` should detect role and render either `AdminDashboard` or `TeacherDashboard`
- **AdminDashboard widgets:**
  - Today's sessions overview
  - Pending tasks (overdue tuition, missing attendance reports)
  - This month's revenue & payroll preview
  - Recent activity feed
- **TeacherDashboard widgets:**
  - Today's classes
  - This week's hours
  - This month's estimated earnings
  - Recent attendance status

### 8.3 Schedule / Timetable

**Current:** Single-user schedule.

**Target:** Multi-teacher, multi-class center-wide schedule.

**Action:**
- Add filtering: by teacher, by class, by room, by date range
- Add week view (currently may be day-only?)
- Add drag-and-drop reschedule
- Add conflict detection
- Generate sessions from class schedule patterns (bulk operation)

### 8.4 Teacher Management (existing)

**Current:** Basic CRUD for teachers.

**Target:** Full lifecycle: invite → onboard → manage rates → payroll integration.

**Action:**
- Add invite flow (generate magic link, send SMS/Zalo)
- Add hourly rate and payment structure fields
- Add teaching history view
- Add earnings history view
- Link to payroll module

### 8.5 Meeting Scheduler

**Current:** Standalone meeting scheduling.

**Target:** Integrated with class sessions.

**Action:**
- Don't standalone — sessions can have an `online_meeting_url` field
- If session is online: provide button to generate Zoom/Meet link
- Integration: Zoom OAuth (defer to v1.5) or manual paste of meeting link

---

## 9. Tech Stack & Standards

### 9.1 Stack (locked for v1)

Document the current stack the project is using. AI agent should respect existing choices and not propose framework migrations unless asked.

- Frontend framework: **[fill in: Next.js / React / etc.]**
- Backend: **[fill in]**
- Database: **[fill in — recommend Postgres if not already]**
- Auth: **[fill in]**
- Hosting: **[fill in]**

### 9.2 Code Standards

- **Language:** TypeScript strict mode if frontend is TS
- **API:** RESTful or tRPC; no GraphQL for v1
- **State management:** Server state via React Query / SWR; client state via Zustand or React Context
- **Forms:** React Hook Form + Zod for validation
- **Dates:** date-fns or dayjs (NOT moment.js)
- **Currency math:** Always integers in cents/đồng. Never floats.
- **Testing:** Unit tests for payroll calculation (critical). Integration tests for core flows.

### 9.3 Folder Structure (suggested)

```
/src
  /modules
    /auth
    /centers
    /teachers
    /students
    /classes
    /sessions
    /attendance
    /payroll
    /invoices
    /reports
  /components       (shared UI)
  /lib              (utilities)
  /types            (TypeScript types)
  /api              (API routes)
  /pages or /app    (routes)
```

Each module is self-contained: components, hooks, API calls, types.

### 9.4 Naming Conventions

- Database: `snake_case`
- TypeScript: `camelCase` for vars, `PascalCase` for types/components
- API endpoints: `/api/v1/teachers`, plural nouns
- Vietnamese in UI strings, English in code

---

## 10. Roadmap & Phases

### Phase 1: Refactor & Foundation (Weeks 1–3)

**Goal:** Codebase aligned with B2B direction.

- [ ] Hide deprecated features from UI
- [ ] Refactor landing page for center owners
- [ ] Split dashboard into Admin / Teacher views
- [ ] Add multi-tenant data model (center_id everywhere)
- [ ] Add role-based access control

**Exit criteria:** Existing features work but now reflect B2B positioning. No new features yet.

### Phase 2: Payroll MVP (Weeks 4–6)

**Goal:** Ship the killer feature.

- [ ] Build student management module
- [ ] Build class management module
- [ ] Build attendance tracking (teacher mobile + admin web)
- [ ] Build payroll calculation engine
- [ ] Build payroll review/approval UI
- [ ] Excel export for payroll

**Exit criteria:** A center owner can run their full monthly payroll in the app.

### Phase 3: Pilot Onboarding (Weeks 7–10)

**Goal:** 2 paying pilot centers using the product.

- [ ] Bulk import (students, teachers) from Excel
- [ ] Onboarding wizard for new centers
- [ ] Email/Zalo invite for teachers
- [ ] Basic reports (monthly summary)
- [ ] Support documentation / FAQ
- [ ] Bug fixes from pilot feedback

**Exit criteria:** 2 centers running full monthly cycle on the platform.

### Phase 4: Tuition & Polish (Weeks 11–13)

**Goal:** Complete the financial loop.

- [ ] Tuition plans & invoicing
- [ ] Payment reminders via Zalo
- [ ] Refine reports based on pilot feedback
- [ ] Performance optimization
- [ ] Mobile UX polish for teacher view

**Exit criteria:** Ready for paid launch to 10–20 centers.

---

## 11. Acceptance Criteria for MVP Launch

The product is ready for paid launch when ALL of the following are true:

### Functional

- [ ] A center owner can sign up and onboard their center in under 30 minutes
- [ ] Bulk import of 100+ students from Excel completes in under 1 minute
- [ ] A teacher can mark attendance for a 10-student class in under 90 seconds on mobile
- [ ] Payroll for a 20-teacher center calculates correctly for 50 test scenarios
- [ ] Payroll Excel export matches Vietnamese accounting standards
- [ ] Schedule conflicts are detected and warned
- [ ] No cross-center data leaks (multi-tenant security tested)

### Non-Functional

- [ ] Page load under 2 seconds on 3G
- [ ] 99% uptime over 30-day test period
- [ ] All UI in Vietnamese, no untranslated strings
- [ ] Mobile (teacher) view works on phones 5 years old
- [ ] All forms validate input and show clear error messages in Vietnamese
- [ ] Audit log captures: who changed what, when, on critical entities (payroll, attendance)

### Business

- [ ] Pricing page live
- [ ] Terms of Service + Privacy Policy in Vietnamese
- [ ] Demo booking flow works
- [ ] Onboarding documentation available
- [ ] Support channel (Zalo or email) set up

---

## 12. Open Questions / Decisions Needed

Items requiring founder decision before next sprint:

1. **Payment gateway:** Stripe (international, easier) vs OnePay/VNPay (local, more familiar to centers)?
2. **Zalo OA integration:** Build now (high value, complex) or defer to v1.5?
3. **Pricing currency:** VND only, or also display USD for premium positioning?
4. **Free trial vs paid pilot:** Offer 14-day free trial, or only paid pilots with concierge onboarding?
5. **Subdomain strategy:** Each center on `centername.app.com` or all on shared domain with center selector?

---

## 13. Glossary

- **Center (Trung tâm):** An education center, our customer
- **Class (Lớp):** A recurring group of students with a defined schedule
- **Session (Buổi học):** One instance of a class meeting
- **Tuition (Học phí):** What students/parents pay to attend
- **Payroll (Lương):** What teachers are paid
- **Attendance (Điểm danh):** Record of who was present at a session

---

## Appendix A: Example Payroll Calculation

**Scenario:** Cô Linh, payment_structure = HOURLY, hourly_rate = 250,000 VND

In October 2026:
- Taught 32 sessions, each 1.5 hours scheduled
- 30 sessions COMPLETED, 2 CANCELLED
- Total check-in/out hours: 44.5 hours
- 1 bonus: +500,000 VND (perfect attendance)
- 1 deduction: −100,000 VND (late twice)

**Calculation:**
```
Hours pay = 44.5 × 250,000 = 11,125,000 VND
Bonuses = +500,000 VND
Deductions = −100,000 VND
Final = 11,525,000 VND
```

**UI shows breakdown clearly. Admin can override final amount with reason.**

---

## Appendix B: Sample API Endpoints (Reference)

```
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/invite-accept

# Centers
GET    /api/v1/centers/:id
PATCH  /api/v1/centers/:id/settings

# Teachers
GET    /api/v1/centers/:id/teachers
POST   /api/v1/centers/:id/teachers
PATCH  /api/v1/teachers/:id
POST   /api/v1/teachers/:id/invite
GET    /api/v1/teachers/:id/earnings

# Students
GET    /api/v1/centers/:id/students
POST   /api/v1/centers/:id/students
POST   /api/v1/centers/:id/students/bulk-import
PATCH  /api/v1/students/:id

# Classes & Sessions
GET    /api/v1/centers/:id/classes
POST   /api/v1/centers/:id/classes
POST   /api/v1/classes/:id/generate-sessions
GET    /api/v1/sessions?from=&to=&teacher_id=
PATCH  /api/v1/sessions/:id

# Attendance
POST   /api/v1/sessions/:id/checkin
POST   /api/v1/sessions/:id/checkout
PUT    /api/v1/sessions/:id/attendance

# Payroll
GET    /api/v1/centers/:id/payroll-periods
POST   /api/v1/centers/:id/payroll-periods
GET    /api/v1/payroll-periods/:id
POST   /api/v1/payroll-periods/:id/approve
GET    /api/v1/payroll-periods/:id/export
```

---

**END OF PRD**

> **Reminder for AI Agent:** When implementing or refactoring, refer back to this PRD frequently. If you find yourself building something not specified here, stop and ask for clarification.
