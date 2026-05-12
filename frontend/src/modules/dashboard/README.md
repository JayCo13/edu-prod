# `modules/dashboard/`

**Status:** Layout-only (no real data). PRD §8.2.

A composite view, not a domain — splits the single legacy dashboard into
two role-routed surfaces:

- **AdminDashboard** — 4 widgets, desktop-leaning (admins on laptops per PRD §7.1)
- **TeacherDashboard** — 3 widgets, mobile-first at 360px (PRD §7.3)

## Layout

```
dashboard/
├── AdminDashboard.tsx           — composes 4 WidgetCards
├── TeacherDashboard.tsx         — composes 3 WidgetCards (mobile-first)
├── resolveDashboardRole.ts      — server helper: admin | teacher
└── components/
    ├── WidgetCard.tsx           — shared card shell (header + body)
    └── EmptyState.tsx           — dashed placeholder used by every widget
```

## Role routing

`/dashboard/page.tsx` calls `resolveDashboardRole()` and renders one or the
other. The resolver checks **both schema cycles** so the page works for
users in either state:

1. New: `user_centers.role_in_center` via `resolveCenterId()`. TEACHER →
   teacher view; CENTER_ADMIN / CENTER_STAFF → admin view.
2. Legacy fallback: tenants.owner_id (admin) or tenant_teachers.is_admin
   (admin) — otherwise teacher.

Default is `"teacher"` (safer/lower-surface view) when role is ambiguous.

## Widgets (placeholders only)

| Dashboard | Widget | Eyebrow | Empty message |
|---|---|---|---|
| Admin | Buổi học hôm nay | Hôm nay | "Chưa có buổi học nào hôm nay." |
| Admin | Việc cần làm | Cần xử lý | "Tất cả đã được xử lý." |
| Admin | Tổng quan tài chính | Tháng này | "Chưa có dữ liệu tháng này." |
| Admin | Hoạt động gần đây | Gần đây | "Chưa có hoạt động nào." |
| Teacher | Lớp hôm nay | Hôm nay | "Hôm nay bạn không có lớp nào." |
| Teacher | Giờ đã dạy | Tuần này | "Tuần này chưa có giờ dạy nào." |
| Teacher | Thu nhập dự kiến | Tháng này | "Chưa có thu nhập tháng này." |

Real data wires from `sessions`, `attendance`, `payroll_items`, `invoices`
in later cycles.
