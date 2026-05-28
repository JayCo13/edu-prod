"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Check,
  Download,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { markAllPayrollItemsPaidAction } from "@/modules/payroll/actions";
import PayoutDialog from "./PayoutDialog";
import {
  approvePayrollAction,
  markPayrollPaidAction,
  recalculatePayrollPeriodAction,
} from "@/modules/payroll/actions";
import type {
  PayrollItemRow,
  PayrollPeriodStatus,
  PayrollPeriodWithItems,
} from "@/modules/payroll/domain-types";
import {
  formatHoursDecimal,
  formatVND,
  PAYROLL_STATUS_LABEL,
} from "@/modules/payroll/format";
import AdjustmentDialog from "./AdjustmentDialog";
import AuditLogModal from "./AuditLogModal";
import BreakdownDrawer from "./BreakdownDrawer";

interface Props {
  period: PayrollPeriodWithItems;
  /** Center's configured monthly payout day (1–31). Null = no schedule set.
   *  Used to warn when "Duyệt và khoá" is fired too early. */
  payoutDay: number | null;
}

/** Asia/Ho_Chi_Minh "today" for the day-of-month math. Server may render
 *  in any tz, but the user's mental model is local. */
function vnTodayLocal(): { year: number; month: number; day: number } {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

/** Returns null when today is "close enough" to the configured payout day,
 *  otherwise returns how many days until that day this month (or next month
 *  if today is already past it). Threshold: anything > 7 days early counts
 *  as a "too early" approve. */
function describeEarlyApprove(
  payoutDay: number | null,
): { daysUntil: number } | null {
  if (payoutDay == null) return null;
  const today = vnTodayLocal();
  // Clamp day to month length (e.g. payout_day=31 in Feb → 28).
  const lastDay = new Date(today.year, today.month, 0).getDate();
  const targetDay = Math.min(payoutDay, lastDay);
  if (today.day < targetDay) {
    const daysUntil = targetDay - today.day;
    return daysUntil > 7 ? { daysUntil } : null;
  }
  // Today is on/after this month's payout day — approving is timely.
  return null;
}

/** "Cơ sở tính" cell — the unit the teacher is actually paid on, based on
 *  their payment_structure. HOURLY → hours; PER_SESSION → sessions;
 *  FIXED_MONTHLY → a fixed label; HYBRID → both pieces joined. Falls back
 *  to em-dash when there's nothing meaningful to show (e.g. HOURLY teacher
 *  with zero hours this month). */
function formatPayBasis(item: PayrollItemRow): {
  primary: string;
  secondary: string | null;
} {
  const { payment_structure } = item.teacher_snapshot;
  const minutes = item.breakdown.hours_taught_minutes;
  const sessions = item.breakdown.sessions_paid;
  const hoursText = formatHoursDecimal(minutes); // "12,5"

  switch (payment_structure) {
    case "HOURLY":
      return minutes > 0
        ? { primary: `${hoursText} giờ`, secondary: `${sessions} buổi` }
        : { primary: "—", secondary: null };
    case "PER_SESSION":
      return sessions > 0
        ? { primary: `${sessions} buổi`, secondary: null }
        : { primary: "—", secondary: null };
    case "FIXED_MONTHLY":
      return { primary: "Cố định / tháng", secondary: null };
    case "HYBRID": {
      const parts: string[] = [];
      if (minutes > 0) parts.push(`${hoursText} giờ`);
      if (sessions > 0) parts.push(`${sessions} buổi`);
      return parts.length > 0
        ? { primary: parts.join(" · "), secondary: null }
        : { primary: "—", secondary: null };
    }
  }
}

/** A teacher's snapshot is "unconfigured" when none of their rate fields
 *  are set — the calculator then returns 0đ regardless of hours/sessions.
 *  We surface this so admins can fix it instead of seeing silent zeros. */
function hasUnconfiguredRate(s: PayrollItemRow["teacher_snapshot"]): boolean {
  const noHourly = !s.hourly_rate || s.hourly_rate === 0;
  const noSession =
    s.per_session_rate == null || s.per_session_rate === 0;
  const noFixed =
    s.fixed_monthly_amount == null || s.fixed_monthly_amount === 0;
  switch (s.payment_structure) {
    case "HOURLY":
      return noHourly;
    case "PER_SESSION":
      return noSession;
    case "FIXED_MONTHLY":
      return noFixed;
    case "HYBRID":
      // All three required for HYBRID to compute anything meaningful.
      return noHourly && noSession && noFixed;
  }
}

export default function PeriodDetailClient({ period, payoutDay }: Props) {
  const confirm = useConfirm();
  const [drawerItem, setDrawerItem] = useState<PayrollItemRow | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<PayrollItemRow | null>(null);
  const [payingItem, setPayingItem] = useState<PayrollItemRow | null>(null);
  // Optimistic paid state — bridges the gap between PayoutDialog closing
  // and router.refresh() committing new server data. Without this, the
  // row shows the "Thanh toán" button again for the brief window between
  // dialog close and refresh, and an admin could re-open the dialog. We
  // mirror the server fields (paid_at + payment_method) per teacher_id;
  // when the real server data lands the union below treats either source
  // as authoritative, so this stays harmless after refresh.
  const [optimisticPaid, setOptimisticPaid] = useState<
    Map<string, { paidAt: string; method: "BANK_TRANSFER" | "CASH" }>
  >(new Map());
  // Tracks WHICH async action is in flight so we can render a spinner on
  // just that button (e.g. "Đánh dấu tất cả" doesn't make Tính lại look
  // disabled). useState instead of useTransition because the latter
  // doesn't keep isPending true across `await` boundaries in async
  // callbacks — buttons would re-enable mid-flight.
  type PendingAction =
    | "approve"
    | "recalc"
    | "markAllBank"
    | null;
  const [pending, setPending] = useState<PendingAction>(null);
  const isPending = pending !== null;

  const status = period.status;
  const canEdit = status === "DRAFT";
  const canApprove = status === "DRAFT";
  const canMarkPaid = status === "APPROVED";
  const canExport = status !== "DRAFT"; // PRD §5.8: export approved periods

  const totals = period.items.reduce(
    (acc, item) => ({
      sessions: acc.sessions + item.breakdown.sessions_paid,
      minutes: acc.minutes + item.breakdown.hours_taught_minutes,
      base: acc.base + item.calculated_amount,
      bonus: acc.bonus + item.breakdown.bonuses,
      deduction: acc.deduction + item.breakdown.deductions,
      final: acc.final + item.final_amount,
    }),
    { sessions: 0, minutes: 0, base: 0, bonus: 0, deduction: 0, final: 0 },
  );

  async function handleApprove() {
    // Early-approve check: if today is more than 7 days before the
    // configured payout day, warn extra hard. Reason: APPROVED locks the
    // snapshot — approving 3 weeks early means new rate fixes won't apply.
    const earlyInfo = describeEarlyApprove(payoutDay);
    const ok = earlyInfo
      ? await confirm({
          title: "Duyệt sớm hơn ngày trả lương?",
          variant: "warning",
          confirmLabel: "Vẫn duyệt và khoá",
          description: (
            <>
              <p>
                Ngày trả lương cấu hình:{" "}
                <strong>ngày {payoutDay} hàng tháng</strong>. Hôm nay còn{" "}
                <strong>{earlyInfo.daysUntil} ngày</strong> nữa.
              </p>
              <p className="mt-2">
                Sau khi duyệt sẽ <strong>không thể chỉnh sửa</strong> điều
                chỉnh hay tính lại. Nếu phát hiện sai sót sau bước này, bạn
                chỉ có thể bù trừ ở kỳ sau.
              </p>
              <p className="mt-2 text-slate-500">
                Khuyến nghị: rà soát xong rồi mới duyệt, sát ngày trả lương.
              </p>
            </>
          ),
        })
      : await confirm({
          title: "Duyệt và khoá kỳ lương?",
          variant: "warning",
          confirmLabel: "Duyệt và khoá",
          description:
            "Sau khi duyệt, kỳ lương sẽ bị khoá và không thể thêm/sửa điều chỉnh hay tính lại.",
        });
    if (!ok) return;
    setPending("approve");
    try {
      const r = await approvePayrollAction(period.id);
      if (r.success) toast.success("Đã duyệt kỳ lương.");
      else toast.error(r.error);
    } finally {
      setPending(null);
    }
  }

  /** Mark every remaining unpaid item with the same method. Useful when a
   *  center pays the whole batch in one shot (most common case). */
  async function handleMarkAllPaid(
    method: "BANK_TRANSFER" | "CASH",
  ) {
    const unpaid = period.items.filter((i) => !i.paid_at);
    if (unpaid.length === 0) return;
    const ok = await confirm({
      title: `Đánh dấu ${unpaid.length} giáo viên đã thanh toán?`,
      variant: "warning",
      confirmLabel: "Đánh dấu tất cả",
      description: (
        <>
          <p>
            Hình thức:{" "}
            <strong>
              {method === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"}
            </strong>
            . Email tương ứng sẽ được gửi đến từng giáo viên.
          </p>
          <p className="mt-2">
            Sau khi đánh dấu, các dòng này bị khoá và không thể hoàn tác từ
            giao diện.
          </p>
        </>
      ),
    });
    if (!ok) return;
    setPending(method === "BANK_TRANSFER" ? "markAllBank" : null);
    // (Cash bulk is gone; this branch only ever runs with BANK_TRANSFER.)
    try {
      const r = await markAllPayrollItemsPaidAction({
        periodId: period.id,
        method,
      });
      if (r.success && r.data) {
        toast.success(`Đã đánh dấu ${r.data.marked} giáo viên đã thanh toán.`);
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setPending(null);
    }
  }

  // Convenience: count remaining unpaid items so the "Đánh dấu tất cả"
  // button can hide itself when there's nothing to do. Includes optimistic
  // paid state so the button disappears the instant the last row is
  // marked, without waiting for the server refresh.
  const unpaidCount = period.items.filter(
    (i) => !i.paid_at && !optimisticPaid.has(i.id),
  ).length;

  async function handleRecalculate() {
    const ok = await confirm({
      title: "Tính lại bảng lương?",
      variant: "info",
      confirmLabel: "Tính lại",
      description:
        "Hệ thống sẽ đọc cấu hình lương hiện tại của giáo viên và buổi học trong kỳ. Điều chỉnh thủ công (thưởng/khấu trừ) sẽ được giữ nguyên.",
    });
    if (!ok) return;
    setPending("recalc");
    try {
      const r = await recalculatePayrollPeriodAction(period.id);
      if (r.success) toast.success("Đã tính lại bảng lương.");
      else toast.error(r.error);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Action bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
            Trạng thái
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* "Tính lại" only makes sense for DRAFT — the snapshot lock is
              intentional once the period is approved/paid. Shown next to
              other DRAFT-only actions so admins find it after fixing rates. */}
          {status === "DRAFT" ? (
            <button
              onClick={handleRecalculate}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Cập nhật bảng lương theo cấu hình mới nhất của giáo viên"
            >
              {pending === "recalc" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {pending === "recalc" ? "Đang tính..." : "Tính lại"}
            </button>
          ) : null}
          {canApprove ? (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {pending === "approve" ? "Đang duyệt..." : "Duyệt & khoá"}
            </button>
          ) : null}
          {/* Per-item flow replaces the old whole-period "Đã thanh toán"
              button. Admin marks each teacher individually via the row
              button + PayoutDialog (where they can also choose CASH). The
              bulk shortcut here covers the common case: "đã chuyển khoản
              cho hết". CASH bulk was removed — cash payouts are personal
              and best handled per-row to avoid mistakes. */}
          {canMarkPaid && unpaidCount > 0 ? (
            <button
              onClick={() => handleMarkAllPaid("BANK_TRANSFER")}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              title="Đánh dấu tất cả còn lại đã chuyển khoản"
            >
              {pending === "markAllBank" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              {pending === "markAllBank"
                ? `Đang đánh dấu ${unpaidCount} giáo viên...`
                : "Đánh dấu tất cả đã CK"}
            </button>
          ) : null}
          {canExport ? (
            <a
              href={`/api/v1/payroll-periods/${period.id}/export`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </a>
          ) : null}
          <AuditLogModal
            periodId={period.id}
            itemIds={period.items.map((i) => i.id)}
          />
        </div>
      </div>

      {/* ── Unconfigured-rate banner ───────────────────────────────
          Surfaced when one or more teachers in this period have no rate
          set — their "Cơ bản" silently zeroes out otherwise. */}
      {(() => {
        const missing = period.items.filter((i) =>
          hasUnconfiguredRate(i.teacher_snapshot),
        );
        if (missing.length === 0) return null;
        const names = missing.map((m) => m.teacher_snapshot.name);
        return (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 text-sm text-amber-900">
              <p className="font-semibold">
                {missing.length} giáo viên chưa cấu hình đơn giá lương.
              </p>
              <p className="mt-0.5 text-xs text-amber-800/90">
                Lương cơ bản đang hiển thị 0đ vì chưa nhập mức (ví dụ:
                250.000đ/giờ). Cập nhật cho:{" "}
                <span className="font-medium">{names.join(", ")}</span>.
              </p>
              <Link
                href="/dashboard/teachers"
                className="mt-1.5 inline-flex items-center text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-700"
              >
                Mở trang Giáo viên để cấu hình →
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── Items table ────────────────────────────────────────── */}
      {period.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-500">
            Kỳ lương này chưa có giáo viên nào.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Sẽ được nạp tự động khi mô-đun “Buổi học” sẵn sàng. Hiện tại có thể
            seed dữ liệu mẫu bằng <code className="font-mono">pnpm seed:payroll</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Họ tên</Th>
                <Th align="right">Cơ sở tính</Th>
                <Th align="right">Cơ bản</Th>
                <Th align="right">Điều chỉnh</Th>
                <Th align="right">Thực lĩnh</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {period.items.map((item) => {
                // Paid rows are "frozen": muted typography + green tint so
                // the eye groups them as "done" at a glance. The row is
                // still clickable (breakdown drawer) because admins might
                // want to verify what they paid — just the action buttons
                // are gone.
                //
                // Merge optimistic mark-paid state so the row flips green
                // the instant PayoutDialog confirms, without waiting for
                // the server refresh. Server data wins when present.
                const optimistic = optimisticPaid.get(item.id);
                const paidAt = item.paid_at ?? optimistic?.paidAt ?? null;
                const paymentMethod =
                  item.payment_method ?? optimistic?.method ?? null;
                const isPaid = !!paidAt;
                return (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    isPaid
                      ? "bg-emerald-50/40"
                      : "cursor-pointer hover:bg-slate-50"
                  }`}
                  onClick={isPaid ? undefined : () => setDrawerItem(item)}
                  aria-disabled={isPaid}
                >
                  <Td>
                    <p
                      className={`font-medium ${
                        isPaid ? "text-slate-500" : "text-slate-900"
                      }`}
                    >
                      {item.teacher_snapshot.name}
                    </p>
                    <p
                      className={`text-xs ${
                        isPaid ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {paymentStructureShort(item.teacher_snapshot.payment_structure)}
                    </p>
                  </Td>
                  <Td align="right">
                    {(() => {
                      const basis = formatPayBasis(item);
                      return (
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-sm tabular-nums ${
                              isPaid ? "text-slate-400" : "text-slate-800"
                            }`}
                          >
                            {basis.primary}
                          </span>
                          {basis.secondary && (
                            <span className="font-mono text-[10.5px] uppercase tracking-wide text-slate-400">
                              {basis.secondary}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </Td>
                  <Td align="right">
                    {hasUnconfiguredRate(item.teacher_snapshot) ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-700"
                        title="Chưa cấu hình đơn giá — cập nhật mức lương cho giáo viên này."
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Chưa cấu hình
                      </span>
                    ) : (
                      <span
                        className={`tabular-nums ${
                          isPaid ? "text-slate-400" : "text-slate-700"
                        }`}
                      >
                        {formatVND(item.calculated_amount)}
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <span
                      className={`tabular-nums ${
                        isPaid ? "text-emerald-700/60" : "text-emerald-700"
                      }`}
                    >
                      {item.breakdown.bonuses > 0
                        ? `+${formatVND(item.breakdown.bonuses)}`
                        : ""}
                    </span>
                    {item.breakdown.deductions > 0 ? (
                      <span
                        className={`ml-1 tabular-nums ${
                          isPaid ? "text-rose-600/60" : "text-rose-600"
                        }`}
                      >
                        −{formatVND(item.breakdown.deductions)}
                      </span>
                    ) : null}
                  </Td>
                  <Td align="right">
                    <span
                      className={`font-semibold tabular-nums ${
                        isPaid ? "text-slate-500" : "text-slate-900"
                      }`}
                    >
                      {formatVND(item.final_amount)}
                    </span>
                  </Td>
                  <Td>
                    {/* Paid-state wins regardless of period status. Defensive
                        against the edge case where an APPROVED period gets
                        reverted to DRAFT via ops SQL while items already
                        had paid_at set — we never want a paid row to
                        expose Điều chỉnh or Thanh toán buttons. Reads
                        merged values so optimistic mark-paid renders
                        instantly. */}
                    {paidAt ? (
                      <div
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5"
                        title={`Đã thanh toán ${new Date(paidAt).toLocaleString("vi-VN")}`}
                      >
                        <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                        <div className="text-left">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Đã thanh toán
                          </p>
                          <p className="font-mono text-[10.5px] text-emerald-800/80">
                            {paymentMethod === "CASH"
                              ? "Tiền mặt"
                              : "Chuyển khoản"}
                          </p>
                        </div>
                      </div>
                    ) : canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdjustingItem(item);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                        Điều chỉnh
                      </button>
                    ) : canMarkPaid ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayingItem(item);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                      >
                        <Wallet className="h-3 w-3" />
                        Thanh toán
                      </button>
                    ) : null}
                  </Td>
                </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-amber-50/60">
              <tr className="text-sm">
                <Td>
                  <span className="font-semibold text-slate-900">TỔNG CỘNG</span>
                </Td>
                <Td align="right">
                  {/* Combined totals — show whichever pieces are non-zero
                      across the whole period, regardless of any single
                      teacher's payment structure. */}
                  <span className="font-semibold tabular-nums text-slate-800">
                    {totals.minutes > 0 || totals.sessions > 0
                      ? [
                          totals.minutes > 0
                            ? `${formatHoursDecimal(totals.minutes)} giờ`
                            : null,
                          totals.sessions > 0
                            ? `${totals.sessions} buổi`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </span>
                </Td>
                <Td align="right">
                  <span className="font-semibold tabular-nums">{formatVND(totals.base)}</span>
                </Td>
                <Td align="right">
                  <span className="font-semibold tabular-nums text-emerald-700">
                    +{formatVND(totals.bonus)}
                  </span>{" "}
                  <span className="font-semibold tabular-nums text-rose-600">
                    −{formatVND(totals.deduction)}
                  </span>
                </Td>
                <Td align="right">
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatVND(totals.final)}
                  </span>
                </Td>
                <Td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────── */}
      <BreakdownDrawer
        item={drawerItem}
        periodId={period.id}
        periodStatus={status}
        onClose={() => setDrawerItem(null)}
      />
      <AdjustmentDialog
        itemId={adjustingItem?.id ?? ""}
        periodId={period.id}
        teacherName={adjustingItem?.teacher_snapshot.name ?? ""}
        open={!!adjustingItem}
        onClose={() => setAdjustingItem(null)}
      />
      {payingItem ? (
        <PayoutDialog
          itemId={payingItem.id}
          periodId={period.id}
          teacherId={payingItem.teacher_id}
          teacherName={payingItem.teacher_snapshot.name}
          amount={payingItem.final_amount}
          open={!!payingItem}
          onClose={() => setPayingItem(null)}
          onPaid={(paidAt, method) => {
            // Optimistic — row flips green immediately. router.refresh() in
            // the dialog still runs; when the real paid_at lands the union
            // in the row's render keeps the same display.
            const id = payingItem?.id;
            if (id) {
              setOptimisticPaid((prev) => {
                const next = new Map(prev);
                next.set(id, { paidAt, method });
                return next;
              });
            }
            setPayingItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: PayrollPeriodStatus }) {
  const color =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700"
      : status === "APPROVED"
        ? "bg-indigo-100 text-indigo-700"
        : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {PAYROLL_STATUS_LABEL[status]}
    </span>
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

function paymentStructureShort(s: string): string {
  switch (s) {
    case "HOURLY":
      return "Theo giờ";
    case "PER_SESSION":
      return "Theo buổi";
    case "FIXED_MONTHLY":
      return "Cố định";
    case "HYBRID":
      return "Kết hợp";
    default:
      return s;
  }
}
