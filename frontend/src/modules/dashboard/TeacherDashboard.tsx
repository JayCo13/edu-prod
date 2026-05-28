import Link from "next/link";
import { CalendarClock, Clock, Wallet, Ban, Banknote } from "lucide-react";
import WidgetCard from "./components/WidgetCard";
import EmptyState from "./components/EmptyState";
import { getTeacherDashboardData } from "./teacher-data";

/**
 * TeacherDashboard — what a teacher sees on the dashboard root.
 *
 * Per PRD §7.3 (mobile teacher view): single-column stack on phone, expands
 * to a 3-up grid on tablets+. Each widget reads from a single server fetch
 * (teacher-data.ts) so the page is one round trip, not three.
 *
 * The numbers shown here are *projections* — definitive payroll math runs
 * when the admin opens a period.
 */

interface Props {
  userName: string;
}

const VND = new Intl.NumberFormat("vi-VN");

function formatVnd(amount: number): string {
  return `${VND.format(amount)}đ`;
}

function formatHours(minutes: number): string {
  // "2h 30m" — concise for a stat tile.
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h}h ${m}m`;
}

function formatSessionTime(iso: string, durationMin: number): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const end = new Date(d.getTime() + durationMin * 60_000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  HOURLY: "Theo giờ",
  PER_SESSION: "Theo buổi",
  FIXED_MONTHLY: "Cố định / tháng",
  HYBRID: "Kết hợp",
};

export default async function TeacherDashboard({ userName }: Props) {
  const data = await getTeacherDashboardData();

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:max-w-5xl sm:space-y-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Tổng quan
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Xin chào, {userName}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Hôm nay bạn dạy gì? Đây là lịch và thu nhập của bạn.
        </p>
      </header>

      {/* Yellow CTA — admin can't chi lương without bank info. */}
      {data && !data.hasPayoutMethod && (
        <Link
          href="/dashboard/payouts"
          className="group flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
        >
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-200">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Bạn chưa cấu hình tài khoản nhận lương.
            </p>
            <p className="mt-0.5 text-xs leading-snug text-amber-800/90">
              Hãy nhập số tài khoản ngân hàng và ảnh QR để quản trị viên trung
              tâm chuyển lương cho bạn đúng hạn.
            </p>
            <p className="mt-1.5 text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2">
              Cấu hình ngay →
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Hôm nay ──────────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Hôm nay"
          title="Lớp hôm nay"
          icon={<CalendarClock className="h-5 w-5" />}
          accent="indigo"
        >
          {!data || data.todaySessions.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              message="Hôm nay bạn không có lớp nào."
              hint="Lớp được lên lịch sẽ hiển thị ở đây."
            />
          ) : (
            <ul className="space-y-2.5">
              {data.todaySessions.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    s.is_cancelled
                      ? "border-rose-100 bg-rose-50/50"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`min-w-0 truncate text-sm font-semibold ${
                        s.is_cancelled
                          ? "text-rose-700 line-through"
                          : "text-slate-900"
                      }`}
                    >
                      {s.title}
                    </p>
                    {s.is_cancelled && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        <Ban className="h-2.5 w-2.5" />
                        Đã huỷ
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tabular-nums text-slate-500">
                    <Clock className="h-3 w-3" />
                    {formatSessionTime(s.start_time, s.duration_minutes)}
                  </div>
                  {s.course_title && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {s.course_title}
                    </p>
                  )}
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href="/dashboard/calendar"
                  className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Xem cả tuần →
                </Link>
              </li>
            </ul>
          )}
        </WidgetCard>

        {/* ── Tuần này ─────────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Tuần này"
          title="Giờ đã dạy"
          icon={<Clock className="h-5 w-5" />}
          accent="emerald"
        >
          {!data ? (
            <EmptyState
              icon={Clock}
              message="Chưa có dữ liệu."
              hint="Đăng nhập với tài khoản giáo viên để xem giờ đã dạy."
            />
          ) : data.weekStats.completed === 0 && data.weekStats.upcoming === 0 ? (
            <EmptyState
              icon={Clock}
              message="Tuần này chưa có lớp nào."
              hint="Lớp được lên lịch sẽ hiển thị ở đây."
            />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-mono text-3xl font-bold tabular-nums text-slate-900">
                  {formatHours(data.weekStats.minutes)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Đã dạy ·{" "}
                  <span className="font-semibold text-slate-700">
                    {data.weekStats.completed} buổi
                  </span>
                </p>
              </div>
              {data.weekStats.upcoming > 0 && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Sắp tới trong tuần:{" "}
                  <span className="font-semibold text-slate-900">
                    {data.weekStats.upcoming} buổi
                  </span>
                </div>
              )}
            </div>
          )}
        </WidgetCard>

        {/* ── Tháng này ────────────────────────────────────────────── */}
        <WidgetCard
          eyebrow="Tháng này"
          title="Thu nhập dự kiến"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        >
          {!data ? (
            <EmptyState
              icon={Wallet}
              message="Chưa có dữ liệu."
              hint="Cấu hình lương sẽ giúp ước tính chính xác hơn."
            />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-mono text-3xl font-bold tabular-nums text-slate-900">
                  {formatVnd(data.monthStats.projectedIncome)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Hình thức:{" "}
                  <span className="font-semibold text-slate-700">
                    {PAYMENT_LABEL[data.monthStats.paymentStructure] ?? "—"}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Buổi đã dạy</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {data.monthStats.completed}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Giờ đã dạy</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatHours(data.monthStats.minutes)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] leading-snug text-slate-400">
                Số ước tính từ lớp đã hoàn thành + đơn giá hiện tại. Số chính
                thức trên bảng lương cuối kỳ có thể khác (thưởng, khấu trừ).
              </p>
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
