import { Calendar, ClipboardList, LineChart, Activity } from "lucide-react";
import WidgetCard from "./components/WidgetCard";
import EmptyState from "./components/EmptyState";

/**
 * AdminDashboard — center owner / staff landing.
 *
 * Per PRD §8.2: 4 widgets, layout only. Real data wires in later cycles.
 * Desktop-leaning layout (admins work on laptops, PRD §7.1).
 *
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

export default function AdminDashboard({ userName }: Props) {
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
          Dữ liệu trung tâm trong nháy mắt. Các số liệu sẽ xuất hiện khi bạn
          có buổi học, học viên và giao dịch.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <WidgetCard
          eyebrow="Hôm nay"
          title="Buổi học hôm nay"
          icon={Calendar}
          accent="indigo"
          showSeeMore
        >
          <EmptyState
            icon={Calendar}
            message="Chưa có buổi học nào hôm nay."
            hint="Lên lịch buổi học ở mục Lịch dạy để bắt đầu."
          />
        </WidgetCard>

        <WidgetCard
          eyebrow="Cần xử lý"
          title="Việc cần làm"
          icon={ClipboardList}
          accent="amber"
          showSeeMore
        >
          <EmptyState
            icon={ClipboardList}
            message="Tất cả đã được xử lý."
            hint="Hóa đơn quá hạn, điểm danh thiếu sẽ hiện ở đây."
          />
        </WidgetCard>

        <WidgetCard
          eyebrow="Tháng này"
          title="Tổng quan tài chính"
          icon={LineChart}
          accent="emerald"
          showSeeMore
        >
          <EmptyState
            icon={LineChart}
            message="Chưa có dữ liệu tháng này."
            hint="Doanh thu, lương giáo viên và lợi nhuận sẽ tổng hợp tự động."
          />
        </WidgetCard>

        <WidgetCard
          eyebrow="Gần đây"
          title="Hoạt động gần đây"
          icon={Activity}
          accent="slate"
        >
          <EmptyState
            icon={Activity}
            message="Chưa có hoạt động nào."
            hint="Thay đổi quan trọng (điểm danh, duyệt lương, hóa đơn) sẽ xuất hiện tại đây."
          />
        </WidgetCard>
      </div>
    </div>
  );
}
