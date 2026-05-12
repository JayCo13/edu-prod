# `modules/students/`

**Status:** BUILD (P0).
**PRD:** [§5.4 Student Management](../../../../PRD.md#54-student-management).

## Entity (PRD §6 `students`)

Belongs to `center_id`. Fields: `full_name`, `phone`, `email` (optional), `dob`, `gender`, `parent_name`, `parent_phone`, `parent_relationship`, `level`, `enrollment_date`, `status` (`ACTIVE | PAUSED | GRADUATED | DROPPED`), `notes` (visible to assigned teachers), `tags`.

Enrollment in classes is many-to-many via `class_students`.

## Build checklist

- [ ] CRUD UI (admin)
- [ ] **Bulk Excel/CSV import** — required for onboarding centers migrating from spreadsheets (PRD §5.4)
- [ ] Search must be diacritic-insensitive (PRD §7.2)
- [ ] Parent contact required when student is a minor
- [ ] Status transitions with reason logging
- [ ] Per-student attendance history (read from `attendance`)

## API (PRD App B)

```
GET    /api/v1/centers/:id/students
POST   /api/v1/centers/:id/students
POST   /api/v1/centers/:id/students/bulk-import
PATCH  /api/v1/students/:id
```

## Notes

- Phone display format: `0901 234 567` (PRD §7.2).
- Don't expose student data outside the center (RLS).
- Bulk import target: 100+ students in <1 minute (PRD §11 acceptance).
