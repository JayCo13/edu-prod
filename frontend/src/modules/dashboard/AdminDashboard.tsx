import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Ban,
  Calendar,
  ClipboardList,
  Clock,
  LineChart,
  UserCog,
  Wallet,
} from "lucide-react";
import WidgetCard from "./components/WidgetCard";
import EmptyState from "./components/EmptyState";
import { getAdminDashboardData } from "./admin-data";

/**
 * AdminDashboard — center owner / staff landing.
 *
 * Per PRD §8.2: four widgets with live data.
 *   ┌──────────┬──────────┐
 *   │ Hôm nay  │ Cần xử lý│
 *   ├──────────┼──────────┤
 *   │ Tháng    │ Hoạt động│
 *   └──────────┴──────────┘
 *
 * On mobile, widgets stack to single column.
 */

interface Props {
  userName: string;
}

const VND = new Intl.NumberFormat("vi-VN");

function formatVnd(amount: number): string {
  return `${VND.format(amount)}đ`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} ngày trước`;
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function formatMonthDay(yyyymmdd: string): string {
  const [, m] = yyyymmdd.split("-");
  return `Tháng ${m}`;
}

export default async function AdminDashboard({ userName }: Props) {
  const data = await getAdminDashboardData();

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Tổng quan
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Xin chào, {userName}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Dữ liệu trung tâm trong nháy mắt — buổi học, lương, và việc cần xử lý.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* ── Hôm nay ────────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Hôm nay"
          title="Buổi học hôm nay"
          icon={<Calendar className="h-5 w-5" />}
          accent="indigo"
          showSeeMore
          tourKey="dashboard.center.today"
        >
          {!data || data.todaySessions.length === 0 ? (
            <EmptyState
              icon={Calendar}
              message="Chưa có buổi học nào hôm nay."
              hint="Lên lịch buổi học ở mục Lịch dạy để bắt đầu."
            />
          ) : (
            <ul className="space-y-2">
              {data.todaySessions.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 ${
                    s.is_cancelled
                      ? "border-rose-100 bg-rose-50/40"
                      : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        s.is_cancelled
                          ? "text-rose-700 line-through"
                          : "text-slate-900"
                      }`}
                    >
                      {s.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="h-3 w-3" />
                        {formatTime(s.start_time)} · {s.duration_minutes}′
                      </span>
                      {s.teacher_name && <span>· {s.teacher_name}</span>}
                      {s.course_title && (
                        <span className="text-slate-400">
                          · {s.course_title}
                        </span>
                      )}
                    </div>
                  </div>
                  {s.is_cancelled && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      <Ban className="h-2.5 w-2.5" />
                      Huỷ
                    </span>
                  )}
                </li>
              ))}
              {data.todaySessions.length > 5 && (
                <li className="pt-1 text-right">
                  <Link
                    href="/dashboard/calendar"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Xem tất cả {data.todaySessions.length} buổi →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </WidgetCard>

        {/* ── Cần xử lý ──────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Cần xử lý"
          title="Việc cần làm"
          icon={<ClipboardList className="h-5 w-5" />}
          accent="amber"
          tourKey="dashboard.todo"
        >
          {!data ||
          (data.todo.teachersWithoutRate.length === 0 &&
            data.todo.pendingPeriods.length === 0) ? (
            <EmptyState
              icon={ClipboardList}
              message="Tất cả đã được xử lý."
              hint="Việc tồn đọng (lương chưa cấu hình, kỳ lương chưa duyệt) sẽ hiện ở đây."
            />
          ) : (
            <ul className="space-y-2">
              {data.todo.teachersWithoutRate.length > 0 && (
                <Todo
                  href="/dashboard/teachers"
                  icon={<UserCog className="h-3.5 w-3.5" />}
                  tone="amber"
                  title={`${data.todo.teachersWithoutRate.length} giáo viên chưa cấu hình lương`}
                  hint={data.todo.teachersWithoutRate
                    .slice(0, 3)
                    .map((t) => t.display_name)
                    .join(", ")}
                />
              )}
              {data.todo.pendingPeriods.map((p) => {
                if (p.status === "DRAFT") {
                  return (
                    <Todo
                      key={p.id}
                      href={`/admin/payroll/${p.id}`}
                      icon={<AlertTriangle className="h-3.5 w-3.5" />}
                      tone="amber"
                      title={`Kỳ lương ${formatMonthDay(p.period_start)} đang chờ duyệt`}
                      hint="Bấm để rà soát + duyệt khoá."
                    />
                  );
                }
                return (
                  <Todo
                    key={p.id}
                    href={`/admin/payroll/${p.id}`}
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    tone="emerald"
                    title={`Kỳ lương ${formatMonthDay(p.period_start)} còn ${p.unpaidCount} giáo viên chưa nhận`}
                    hint="Đã duyệt — cần chuyển khoản & đánh dấu."
                  />
                );
              })}
            </ul>
          )}
        </WidgetCard>

        {/* ── Tháng này ──────────────────────────────────────────── */}
        <WidgetCard
          eyebrow={data?.finance.monthLabel ?? "Tháng này"}
          title="Tổng quan tài chính"
          icon={<LineChart className="h-5 w-5" />}
          accent="emerald"
          showSeeMore
          tourKey="dashboard.center.finance"
        >
          {!data ? (
            <EmptyState
              icon={LineChart}
              message="Chưa có dữ liệu tháng này."
              hint="Doanh thu, lương giáo viên và lợi nhuận sẽ tổng hợp tự động."
            />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-700">
                  Tổng lương dự kiến
                </p>
                <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                  {formatVnd(data.finance.totalPayroll)}
                </p>
                {data.finance.paidThisMonth > 0 && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Đã chi:{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatVnd(data.finance.paidThisMonth)}
                    </span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Buổi đã/đang dạy"
                  value={data.finance.sessionsCount.toString()}
                />
                <Stat
                  label="Giáo viên hoạt động"
                  value={data.finance.activeTeachers.toString()}
                />
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] leading-snug text-slate-500">
                {data.finance.configuredRates} / {data.finance.activeTeachers}{" "}
                giáo viên đã có đơn giá lương.
              </div>
            </div>
          )}
        </WidgetCard>

        {/* ── Hoạt động gần đây ──────────────────────────────────── */}
        <WidgetCard
          eyebrow="Gần đây"
          title="Hoạt động gần đây"
          icon={<Activity className="h-5 w-5" />}
          accent="slate"
        >
          {!data || data.recentActivity.length === 0 ? (
            <EmptyState
              icon={Activity}
              message="Chưa có hoạt động nào."
              hint="Thay đổi quan trọng (điểm danh, duyệt lương, hoá đơn) sẽ xuất hiện ở đây."
            />
          ) : (
            <ul className="space-y-2.5">
              {data.recentActivity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-slate-800">
                      {a.summary}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-slate-400">
                      {a.actorName && (
                        <span className="font-semibold text-slate-500">
                          {a.actorName}
                        </span>
                      )}
                      <span className="font-mono">{formatRelative(a.created_at)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function Todo({
  href,
  icon,
  tone,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  tone: "amber" | "emerald";
  title: string;
  hint?: string;
}) {
  const palette = {
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100",
    emerald:
      "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100",
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
