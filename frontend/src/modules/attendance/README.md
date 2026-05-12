# `modules/attendance/`

**Status:** BUILD (P0).
**PRD:** [§5.7 Attendance Tracking](../../../../PRD.md#57-attendance-tracking).

## Entity (PRD §6 `attendance`)

`session_id`, `student_id`, `status` (`PRESENT | ABSENT | LATE | EXCUSED`), `notes`, `marked_by` (FK → users), `marked_at`.

Indexed `(session_id)` and `(student_id, marked_at)`.

## Build checklist

- [ ] Teacher mobile UI: big "Start Class" → records `sessions.teacher_checkin_at`
- [ ] Student list with **tap-to-toggle** status (1 tap per student)
- [ ] "End Class" → records `sessions.teacher_checkout_at` + optional note
- [ ] **Offline-first** queue (sync when network returns) — teachers may be on 3G in classrooms
- [ ] Admin retroactive correction (audited via `marked_by`, `marked_at`)
- [ ] Per-student attendance % over time
- [ ] Per-class attendance trend
- [ ] Teacher reliability metric (% sessions started on time)

## Mobile UX targets (PRD §7.3, §11)

- Mark attendance for a 10-student class in **<90 seconds** on mobile.
- 44px+ tap targets, bottom navigation.
- Works on phones 5+ years old, slow 3G.

## API (PRD App B)

```
PUT    /api/v1/sessions/:id/attendance
```

## Notes

- "PRESENT" should be the default to minimize taps in the common case.
- LATE counts as present for tuition/payroll but flags for the reliability metric.
- EXCUSED requires an admin to set (teachers can request but not approve).
- All marks audit-logged (PRD §11 acceptance: who changed what, when on attendance + payroll).
