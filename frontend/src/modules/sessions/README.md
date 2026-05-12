# `modules/sessions/`

**Status:** REFACTOR + EXPAND — supersedes `live_sessions` and the standalone meeting scheduler.
**PRD:** [§5.6 Schedule / Timetable](../../../../PRD.md#56-schedule--timetable), [§8.3](../../../../PRD.md#83-schedule--timetable), [§8.5](../../../../PRD.md#85-meeting-scheduler).

A **session (buổi học)** is one instance of a class meeting. Calendar/timetable views live here too.

## Entity (PRD §6 `sessions`)

`class_id`, `date`, `start_time`, `end_time`, `assigned_teacher_id` (may differ from class default if substitute), `status` (`SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED | RESCHEDULED`), `room`, `online_meeting_url`, `teacher_checkin_at`, `teacher_checkout_at`, `notes`.

Indexed `(center_id, date)` — composite, critical for week/day queries.

## Refactor / build checklist

- [ ] Migrate from `live_sessions` → `sessions` (preserve existing rows)
- [ ] **Week view (admin)** — all classes across all teachers, color-coded by teacher/class
- [ ] **Day view (admin)** — today's sessions with attendance status
- [ ] **My schedule (teacher)** — phone-friendly, sticky "Start Class" button
- [ ] **List view** — filterable, exportable to Excel
- [ ] Drag-and-drop reschedule (week view)
- [ ] Conflict detection: teacher double-booked, room double-booked, student in two classes at same time
- [ ] Bulk generate-from-pattern (called by `classes/generate-sessions`)
- [ ] Cancel with reason
- [ ] Assign substitute teacher (payroll then goes to substitute, not original — see `modules/payroll/`)

## BYOM (Bring-Your-Own-Meeting)

Online sessions store a paste-in `meeting_url`. Provider is auto-detected from hostname via `lib/meeting-provider.ts`. **Never build server-side Zoom/Meet/Teams creation** — explicitly out of scope (PRD §1.4, §8.5).

## API (PRD App B)

```
GET    /api/v1/sessions?from=&to=&teacher_id=
PATCH  /api/v1/sessions/:id
POST   /api/v1/sessions/:id/checkin
POST   /api/v1/sessions/:id/checkout
```

## Notes

- All times in center's timezone (default `Asia/Ho_Chi_Minh`).
- Date format `DD/MM/YYYY`, 24h time (PRD §7.2).
- Check-in/out timestamps feed payroll hour calculation — `hours = checkout - checkin`, capped at `scheduled_duration × 1.1` (PRD §5.8).
