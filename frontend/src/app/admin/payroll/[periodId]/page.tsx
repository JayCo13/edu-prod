import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPayrollPeriod } from "@/modules/payroll/service";
import { getPayoutScheduleAction } from "@/modules/payroll/actions";
import {
  formatDateVN,
  formatMonthYear,
} from "@/modules/payroll/format";
import PeriodDetailClient from "./_components/PeriodDetailClient";

export const metadata: Metadata = {
  title: "Chi tiết kỳ lương — Edura",
};

interface PageProps {
  params: Promise<{ periodId: string }>;
}

export default async function PayrollPeriodDetailPage({ params }: PageProps) {
  const { periodId } = await params;
  const result = await getPayrollPeriod(periodId);

  if (!result.success) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <BackLink />
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {result.error}
        </div>
      </div>
    );
  }

  const period = result.data;
  // Used by PeriodDetailClient to warn when the admin clicks "Duyệt và khoá"
  // too far before the configured monthly payout day.
  const scheduleResult = await getPayoutScheduleAction();
  const payoutDay = scheduleResult.success
    ? scheduleResult.data.payout_day
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Kỳ lương
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tháng {formatMonthYear(period.period_start)}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {formatDateVN(period.period_start)} – {formatDateVN(period.period_end)}
            {period.notes ? <span className="ml-2 text-slate-400">· {period.notes}</span> : null}
          </p>
        </div>
        <Link
          href={`/admin/payroll/${periodId}/shadow`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          So sánh engine →
        </Link>
      </header>

      <PeriodDetailClient period={period} payoutDay={payoutDay} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/payroll"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Quay lại danh sách
    </Link>
  );
}
