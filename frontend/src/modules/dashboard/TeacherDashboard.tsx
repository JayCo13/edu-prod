import { CalendarClock, Clock, Wallet } from "lucide-react";
import WidgetCard from "./components/WidgetCard";
import EmptyState from "./components/EmptyState";

/**
 * TeacherDashboard — what a teacher sees on their phone.
 *
 * Per PRD §7.3 (mobile teacher view): designed to be useful at 360px in a
 * noisy classroom. Single-column stack on phone, expands to a 3-up grid on
 * tablets+. 44px tap targets on any interactive surface added later.
 * Bottom navigation lives in AdminShell (already mounted by the layout).
 *
 *   360px:
 *     ┌──────────┐
 *     │ Hôm nay  │
 *     ├──────────┤
 *     │ Tuần này │
 *     ├──────────┤
 *     │ Thu nhập │
 *     └──────────┘
 *
 *   ≥1024px:
 *     ┌────────┬────────┬────────┐
 *     │ Hôm nay│ Tuần   │ Thu n. │
 *     └────────┴────────┴────────┘
 */

interface Props {
  userName: string;
}

export default function TeacherDashboard({ userName }: Props) {
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

      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetCard
          eyebrow="Hôm nay"
          title="Lớp hôm nay"
          icon={CalendarClock}
          accent="indigo"
        >
          <EmptyState
            icon={CalendarClock}
            message="Hôm nay bạn không có lớp nào."
            hint="Lớp được lên lịch sẽ hiển thị ở đây."
          />
        </WidgetCard>

        <WidgetCard
          eyebrow="Tuần này"
          title="Giờ đã dạy"
          icon={Clock}
          accent="emerald"
        >
          <EmptyState
            icon={Clock}
            message="Tuần này chưa có giờ dạy nào."
            hint="Giờ được tính khi bạn bấm 'Bắt đầu lớp'."
          />
        </WidgetCard>

        <WidgetCard
          eyebrow="Tháng này"
          title="Thu nhập dự kiến"
          icon={Wallet}
          accent="amber"
        >
          <EmptyState
            icon={Wallet}
            message="Chưa có thu nhập tháng này."
            hint="Số tiền cập nhật theo giờ dạy đã ghi nhận."
          />
        </WidgetCard>
      </div>
    </div>
  );
}
