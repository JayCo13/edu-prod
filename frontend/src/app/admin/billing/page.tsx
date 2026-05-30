import Link from "next/link";
import { Calendar, CheckCircle2, Clock, CreditCard, Receipt, XCircle } from "lucide-react";

import { getBillingOverview } from "@/modules/billing/actions";
import { PLAN_CATALOG } from "@/modules/billing/types";
import type { PaymentOrderRow, SubscriptionRow } from "@/modules/billing/types";

import BillingInfoForm from "./_components/BillingInfoForm";
import CheckoutButton from "./_components/CheckoutButton";

interface PageProps {
  searchParams: Promise<{ status?: string; order?: string }>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const result = await getBillingOverview();

  if (!result.success) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Thanh toán</h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {result.error}
        </div>
      </div>
    );
  }

  const { billingInfo, subscription, recentPayments } = result.data;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      {/* ── Header ─── */}
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Quản lý gói
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Thanh toán &amp; Hoá đơn
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Gói đang dùng, lịch sử thanh toán, và thông tin xuất hoá đơn điện tử.
        </p>
      </header>

      {/* ── Banner sau khi quay về từ PayOS ─── */}
      {sp.status === "success" && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Cảm ơn bạn đã thanh toán!
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              Đang xác nhận giao dịch từ PayOS. Khi hoàn tất, hoá đơn điện tử
              sẽ được gửi vào email người nhận trong vòng vài phút.
            </p>
          </div>
        </div>
      )}
      {sp.status === "cancel" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Đã huỷ thanh toán.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Không có khoản phí nào bị trừ. Bạn có thể thử lại bất cứ lúc nào.
            </p>
          </div>
        </div>
      )}

      {/* ── Subscription card ─── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              Gói hiện tại
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {subscription
                ? PLAN_CATALOG[subscription.plan].name
                : "Chưa đăng ký gói"}
            </h2>
            {subscription && (
              <p className="mt-1 text-sm text-slate-600">
                {formatVnd(subscription.price_vnd)} / tháng
              </p>
            )}
          </div>
          <SubscriptionBadge sub={subscription} />
        </div>

        {subscription ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoBox
              icon={<Calendar className="h-4 w-4" />}
              label="Chu kỳ hiện tại"
              value={`${formatDate(subscription.current_period_start)} → ${formatDate(subscription.current_period_end)}`}
            />
            <InfoBox
              icon={<Clock className="h-4 w-4" />}
              label="Ngày gia hạn tiếp"
              value={formatDate(subscription.current_period_end)}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Đăng ký gói để bắt đầu sử dụng đầy đủ các tính năng.
          </p>
        )}

        {/* CTA: gia hạn / đăng ký mới */}
        <div className="mt-5">
          <CheckoutButton
            plan="GROWTH"
            label={subscription ? "Gia hạn 1 tháng" : "Đăng ký gói Growth"}
            disabled={!billingInfo}
          />
          {!billingInfo && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠ Cần khai báo thông tin xuất hoá đơn bên dưới trước khi thanh toán.
            </p>
          )}
        </div>
      </section>

      {/* ── Lịch sử thanh toán ─── */}
      {recentPayments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">
              Lịch sử thanh toán
            </h2>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ngày tạo</th>
                  <th className="px-3 py-2 text-left">Mã đơn</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.map((p) => (
                  <PaymentRow key={p.id} order={p} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Billing info form ─── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-bold text-slate-900">
            Thông tin xuất hoá đơn
          </h2>
        </div>
        <BillingInfoForm initial={billingInfo} />
      </section>

      <p className="text-center text-xs text-slate-400">
        Cần hỗ trợ?{" "}
        <Link href="/" className="font-semibold text-slate-600 hover:text-slate-900">
          Liên hệ Edura →
        </Link>
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function SubscriptionBadge({ sub }: { sub: SubscriptionRow | null }) {
  if (!sub) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Chưa đăng ký
      </span>
    );
  }
  const colorByStatus: Record<SubscriptionRow["status"], string> = {
    TRIAL: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    PAST_DUE: "bg-amber-50 text-amber-700 ring-amber-200",
    SUSPENDED: "bg-rose-50 text-rose-700 ring-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const labelByStatus: Record<SubscriptionRow["status"], string> = {
    TRIAL: "Đang dùng thử",
    ACTIVE: "Đang hoạt động",
    PAST_DUE: "Quá hạn",
    SUSPENDED: "Tạm khoá",
    CANCELLED: "Đã huỷ",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorByStatus[sub.status]}`}
    >
      {labelByStatus[sub.status]}
    </span>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <p className="text-[11px] font-mono uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PaymentRow({ order }: { order: PaymentOrderRow }) {
  const colorByStatus: Record<PaymentOrderRow["status"], string> = {
    PENDING: "text-amber-700 bg-amber-50",
    PAID: "text-emerald-700 bg-emerald-50",
    FAILED: "text-rose-700 bg-rose-50",
    EXPIRED: "text-slate-600 bg-slate-100",
  };
  const labelByStatus: Record<PaymentOrderRow["status"], string> = {
    PENDING: "Đang chờ",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    EXPIRED: "Hết hạn",
  };
  return (
    <tr>
      <td className="px-3 py-2 text-slate-700">
        {formatDate(order.created_at)}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-slate-500">
        {order.payos_order_code}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">
        {formatVnd(order.amount_vnd)}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorByStatus[order.status]}`}
        >
          {labelByStatus[order.status]}
        </span>
      </td>
    </tr>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
