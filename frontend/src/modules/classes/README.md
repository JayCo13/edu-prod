# `modules/classes/`

**Status:** BUILD (P0).
**PRD:** [§5.5 Class Management](../../../../PRD.md#55-class-management).

A **class (lớp)** is a recurring group of students with one or more teachers. Each meeting is a **session** (see `modules/sessions/`).

## Entities (PRD §6)

- `classes` — `name`, `type`, `max_capacity`, `schedule_pattern` (JSONB, e.g. `{"days":["MON","WED","FRI"],"start":"19:00","duration_min":120}`), `start_date`, `end_date`, `default_room`, `tuition_plan_id` (nullable).
- `class_teachers` — `class_id`, `teacher_id`, `role` (`primary | assistant`).
- `class_students` — `class_id`, `student_id`, `enrolled_at`, `unenrolled_at`.

## Build checklist

- [ ] Class CRUD with multi-teacher and multi-student assignment
- [ ] `schedule_pattern` editor (day picker + time + duration)
- [ ] **Generate sessions** from schedule pattern in bulk (e.g., 3 months ahead) — emits rows into `sessions`
- [ ] Enrollment management (add/remove students)
- [ ] Tuition plan linkage (see `modules/invoices/`)

## Difference from old "courses"

`courses` / `modules` / `lessons` / `lesson_progress` are deprecated (LMS out of scope, PRD §1.4). Don't extend them. `classes` is the new recurring-template concept.

## API (PRD App B)

```
GET    /api/v1/centers/:id/classes
POST   /api/v1/centers/:id/classes
POST   /api/v1/classes/:id/generate-sessions
```

## Notes

- A class without students is fine (admins set up the shell first).
- Capacity warning when enrollment > `max_capacity`, not a hard block.
