import type { Metadata } from "next";
import Link from "next/link";
import { listPayrollPeriods } from "@/modules/payroll/service";
import {
  formatDateVN,
  formatMonthYear,
  PAYROLL_STATUS_LABEL,
} from "@/modules/payroll/format";
import {
  ensurePreviousMonthPeriodAction,
  getPayoutScheduleAction,
} from "@/modules/payroll/actions";
import CreatePeriodDialog from "./_components/CreatePeriodDialog";
import PayoutScheduleCard from "./_components/PayoutScheduleCard";
import WorkflowHelpButton from "./_components/WorkflowHelpButton";

export const metadata: Metadata = {
  title: "Bảng lương — VLearning",
};

/**
 * /admin/payroll — period list.
 * Only CENTER_ADMIN reaches this (service + RLS both check).
 */
export default async function PayrollListPage() {
  // Lazy auto-generation: if the admin has configured a payout day and
  // today is on/after it for this month, generate last month's period
  // before we read the list. Idempotent — no-op when already created.
  await ensurePreviousMonthPeriodAction().catch(() => null);

  const [result, scheduleResult] = await Promise.all([
    listPayrollPeriods(),
    getPayoutScheduleAction(),
  ]);
  const schedule = scheduleResult.success ? scheduleResult.data : null;

  if (!result.success) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {result.error}
        </div>
      </div>
    );
  }

  const periods = result.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tài chính
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bảng lương
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Tổng hợp lương theo tháng. Soạn thảo → Duyệt → Đánh dấu đã thanh toán.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <WorkflowHelpButton />
          <CreatePeriodDialog />
        </div>
      </header>

      {schedule && <PayoutScheduleCard schedule={schedule} />}

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">
            Chưa có kỳ lương nào.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Bấm “Tạo kỳ lương mới” để bắt đầu.
          </p>
        </div>
      ) : (
        <div
          data-tour="payroll.periods-list"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Tháng</Th>
                <Th>Khoảng thời gian</Th>
                <Th>Trạng thái</Th>
                <Th align="right">Duyệt lúc</Th>
                <Th align="right">Thanh toán lúc</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50">
                  <Td>
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {formatMonthYear(p.period_start)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-slate-600">
                      {formatDateVN(p.period_start)} – {formatDateVN(p.period_end)}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td align="right">
                    <span className="text-xs text-slate-500">
                      {p.approved_at ? formatDateVN(p.approved_at.slice(0, 10)) : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="text-xs text-slate-500">
                      {p.paid_at ? formatDateVN(p.paid_at.slice(0, 10)) : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <Link
                      href={`/admin/payroll/${p.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Mở →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: keyof typeof PAYROLL_STATUS_LABEL }) {
  const color =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700"
      : status === "APPROVED"
        ? "bg-indigo-100 text-indigo-700"
        : "bg-emerald-100 text-emerald-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
      {PAYROLL_STATUS_LABEL[status]}
    </span>
  );
}
