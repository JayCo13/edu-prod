import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Calendar,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  School,
  UserCog,
  Users,
} from "lucide-react";

import WidgetCard from "./components/WidgetCard";
import EmptyState from "./components/EmptyState";
import { getSchoolDashboardData } from "./school-data";

/**
 * SchoolDashboard — landing page for SCHOOL-kind tenants (migration 0031).
 *
 * Layout differs from CenterAdminDashboard because the SCHOOL product face
 * doesn't have payroll / sessions — it's a timetable-management tool.
 *
 *   ┌─────────────┬─────────────┐
 *   │ Tổng quan   │ Việc cần làm│   roster counts + setup gaps
 *   ├─────────────┼─────────────┤
 *   │ Theo khối   │ Bắt đầu     │   per-grade table + quick actions
 *   └─────────────┴─────────────┘
 */

interface Props {
  userName: string;
}

export default async function SchoolDashboard({ userName }: Props) {
  const data = await getSchoolDashboardData();

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
          Trường học · Tổng quan
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Xin chào, {userName}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Quản lý thời khoá biểu, lớp học và giáo viên của trường ở một chỗ.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* ── Tổng quan trường ───────────────────────────────────── */}
        <WidgetCard
          eyebrow="Tổng quan"
          title="Trường của bạn"
          icon={<School className="h-5 w-5" />}
          accent="indigo"
          tourKey="dashboard.school.overview"
        >
          {!data ? (
            <EmptyState
              icon={School}
              message="Chưa có dữ liệu."
              hint="Khi bạn thêm lớp / giáo viên / môn, số liệu sẽ hiện ở đây."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat
                icon={<GraduationCap className="h-3.5 w-3.5" />}
                label="Lớp"
                value={data.counts.classes}
              />
              <Stat
                icon={<Users className="h-3.5 w-3.5" />}
                label="Giáo viên"
                value={data.counts.teachers}
              />
              <Stat
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
                label="Môn"
                value={data.counts.subjects}
              />
              <Stat
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Khung tiết"
                value={data.counts.periods}
              />
              {data.counts.totalSlots > 0 && (
                <div className="col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2 sm:col-span-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono uppercase tracking-wide text-indigo-700">
                      Mức độ hoàn thành TKB
                    </span>
                    <span className="font-mono tabular-nums text-indigo-900">
                      {data.counts.filledSlots}/{data.counts.totalSlots}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (data.counts.filledSlots /
                              Math.max(1, data.counts.totalSlots)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </WidgetCard>

        {/* ── Việc cần làm ───────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Cần xử lý"
          title="Việc cần làm"
          icon={<ClipboardList className="h-5 w-5" />}
          accent="amber"
          tourKey="dashboard.todo"
        >
          {!data ||
          (data.todo.classesWithoutHomeroom.length === 0 &&
            data.todo.teachersWithoutRole.length === 0 &&
            data.todo.gradesMissingSchedule.length === 0) ? (
            <EmptyState
              icon={ClipboardList}
              message="Mọi thứ đã sẵn sàng!"
              hint="Lớp chưa có GVCN, GV chưa gán vai trò, hoặc khối chưa xếp TKB sẽ hiện ở đây."
            />
          ) : (
            <ul className="space-y-2">
              {data.todo.classesWithoutHomeroom.length > 0 && (
                <Todo
                  href="/dashboard/timetable/classes"
                  icon={<UserCog className="h-3.5 w-3.5" />}
                  tone="amber"
                  title={`${data.todo.classesWithoutHomeroom.length} lớp chưa có GVCN`}
                  hint={data.todo.classesWithoutHomeroom
                    .map((c) => c.name)
                    .join(", ")}
                />
              )}
              {data.todo.gradesMissingSchedule.length > 0 && (
                <Todo
                  href="/dashboard/timetable/editor"
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  tone="amber"
                  title={`Khối ${data.todo.gradesMissingSchedule.join(", ")} chưa xếp TKB`}
                  hint="Mở Editor để bắt đầu xếp lịch cho khối này."
                />
              )}
              {data.todo.teachersWithoutRole.length > 0 && (
                <Todo
                  href="/dashboard/teachers"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  tone="slate"
                  title={`${data.todo.teachersWithoutRole.length} giáo viên chưa gán vai trò`}
                  hint={data.todo.teachersWithoutRole
                    .map((t) => t.display_name)
                    .join(", ")}
                />
              )}
            </ul>
          )}
        </WidgetCard>

        {/* ── Theo khối ─────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Theo khối"
          title="Thời khoá biểu theo khối"
          icon={<LayoutGrid className="h-5 w-5" />}
          accent="cyan"
          showSeeMore
          tourKey="dashboard.grade-breakdown"
        >
          {!data || data.gradeBreakdown.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              message="Chưa có khối nào."
              hint="Thêm lớp và gán khối (6-12) để bắt đầu xếp TKB."
            />
          ) : (
            <ul className="space-y-1.5">
              {data.gradeBreakdown.map((g) => {
                const hrPct = Math.round(
                  (g.classesWithHomeroom / Math.max(1, g.classes)) * 100,
                );
                return (
                  <li key={g.grade}>
                    <Link
                      href={`/dashboard/timetable/editor?grade=${g.grade}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 font-display text-sm font-bold text-cyan-700">
                          {g.grade}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900">
                            Khối {g.grade}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {g.classes} lớp · {g.classesWithHomeroom}/{g.classes}{" "}
                            có GVCN ({hrPct}%)
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tabular-nums text-slate-500">
                        {g.filledSlots} tiết
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </WidgetCard>

        {/* ── Bắt đầu nhanh ─────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Bắt đầu"
          title="Lối tắt"
          icon={<ArrowRight className="h-5 w-5" />}
          accent="slate"
        >
          <ul className="space-y-2">
            <QuickAction
              href="/dashboard/timetable/editor"
              title="Xếp thời khoá biểu"
              hint="Mở grid Ngày × Tiết × Lớp để gán môn và giáo viên."
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <QuickAction
              href="/dashboard/timetable/classes"
              title="Quản lý lớp"
              hint="Tạo nhanh nhiều lớp theo khối (6A1-6A12, 7.1-7.12, ...)."
              icon={<GraduationCap className="h-4 w-4" />}
            />
            <QuickAction
              href="/dashboard/teachers"
              title="Quản lý giáo viên + vai trò"
              hint="Thêm GV, gán Hiệu trưởng / GVCN / GV bộ môn..."
              icon={<Users className="h-4 w-4" />}
            />
            <QuickAction
              href="/dashboard/timetable/subjects"
              title="Thư viện môn học"
              hint="Tạo nhanh danh sách môn chuẩn Bộ GD&ĐT."
              icon={<LayoutGrid className="h-4 w-4" />}
            />
          </ul>
        </WidgetCard>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Todo({
  href,
  icon,
  tone,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  tone: "amber" | "slate";
  title: string;
  hint?: string;
}) {
  const palette = {
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  }[tone];
  return (
    <li>
      <Link
        href={href}
        className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition-colors ${palette}`}
      >
        <div className="mt-0.5 flex-shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {hint && (
            <p className="mt-0.5 truncate text-[11px] opacity-80">{hint}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function QuickAction({
  href,
  title,
  hint,
  icon,
}: {
  href: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
      >
        <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-slate-900 group-hover:text-white">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-slate-900">
            {title}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
            {hint}
          </p>
        </div>
        <ArrowRight className="mt-2 h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
      </Link>
    </li>
  );
}

