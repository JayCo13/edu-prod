import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";

import { listPaymentAlerts } from "@/modules/students/actions";

/**
 * PaymentAlertBanner — Server Component.
 *
 * Hiển thị badge cảnh báo học phí trên đầu AdminDashboard (CENTER):
 *   • N học sinh quá hạn — total tiền cần thu
 *   • M học sinh sắp tới hạn ≤ 7 ngày
 *
 * Click → /dashboard/payments để xử lý.
 *
 * Trả về null nếu không có gì cần cảnh báo (im lặng tốt hơn ồn).
 */
export default async function PaymentAlertBanner() {
  const res = await listPaymentAlerts({ warningWindowDays: 7 }).catch(() => null);
  if (!res || !res.success || res.data.length === 0) return null;

  const overdue = res.data.filter((a) => a.days_until_due < 0);
  const upcoming = res.data.filter((a) => a.days_until_due >= 0);
  const overdueTotal = overdue.reduce((s, a) => s + a.remaining_vnd, 0);
  const upcomingTotal = upcoming.reduce((s, a) => s + a.remaining_vnd, 0);

  // Worst-case first cho readability.
  const worst = overdue[0] ?? upcoming[0];

  return (
    <Link
      href="/dashboard/payments"
      className={`block rounded-2xl border p-3.5 transition hover:shadow-sm ${
        overdue.length > 0
          ? "border-rose-200 bg-rose-50/50 hover:bg-rose-50"
          : "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-full p-2 ${
            overdue.length > 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {overdue.length > 0 ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-bold ${
              overdue.length > 0 ? "text-rose-900" : "text-amber-900"
            }`}
          >
            {overdue.length > 0 ? "Có học phí quá hạn cần thu" : "Sắp tới hạn đóng học phí"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
            {overdue.length > 0 && (
              <>
                <strong className="font-semibold">{overdue.length} HS</strong> quá hạn (
                <strong className="font-mono">{formatVnd(overdueTotal)}</strong>)
                {upcoming.length > 0 && " · "}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <strong className="font-semibold">{upcoming.length} HS</strong> sắp tới hạn 7 ngày (
                <strong className="font-mono">{formatVnd(upcomingTotal)}</strong>)
              </>
            )}
          </p>
          {worst && (
            <p className="mt-1 truncate text-xs text-slate-600">
              VD: <strong>{worst.student.display_name}</strong>
              {worst.class_name && ` · ${worst.class_name}`} ·{" "}
              {worst.days_until_due < 0
                ? `quá ${Math.abs(worst.days_until_due)} ngày`
                : worst.days_until_due === 0
                  ? "hôm nay"
                  : `còn ${worst.days_until_due} ngày`}
            </p>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 ${
            overdue.length > 0 ? "text-rose-500" : "text-amber-500"
          }`}
        />
      </div>
    </Link>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
