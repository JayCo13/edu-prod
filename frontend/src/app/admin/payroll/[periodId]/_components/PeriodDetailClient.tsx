"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Lock, Plus, Wallet } from "lucide-react";
import {
  approvePayrollAction,
  markPayrollPaidAction,
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
}

export default function PeriodDetailClient({ period }: Props) {
  const [drawerItem, setDrawerItem] = useState<PayrollItemRow | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<PayrollItemRow | null>(null);
  const [pending, startTransition] = useTransition();

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

  function handleApprove() {
    if (
      !confirm(
        "Duyệt và khoá kỳ lương này? Sau khi duyệt sẽ không thể chỉnh sửa.",
      )
    )
      return;
    startTransition(async () => {
      const r = await approvePayrollAction(period.id);
      if (r.success) toast.success("Đã duyệt kỳ lương.");
      else toast.error(r.error);
    });
  }

  function handleMarkPaid() {
    if (!confirm("Xác nhận đã thanh toán cho tất cả giáo viên?")) return;
    startTransition(async () => {
      const r = await markPayrollPaidAction(period.id);
      if (r.success) toast.success("Đã đánh dấu là đã thanh toán.");
      else toast.error(r.error);
    });
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
          {canApprove ? (
            <button
              onClick={handleApprove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              Duyệt &amp; khoá
            </button>
          ) : null}
          {canMarkPaid ? (
            <button
              onClick={handleMarkPaid}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              Đã thanh toán
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
                <Th align="right">Buổi</Th>
                <Th align="right">Giờ</Th>
                <Th align="right">Cơ bản</Th>
                <Th align="right">Điều chỉnh</Th>
                <Th align="right">Thực lĩnh</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {period.items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => setDrawerItem(item)}
                >
                  <Td>
                    <p className="font-medium text-slate-900">
                      {item.teacher_snapshot.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {paymentStructureShort(item.teacher_snapshot.payment_structure)}
                    </p>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums">
                      {item.breakdown.sessions_paid}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums text-slate-700">
                      {item.breakdown.hours_taught_minutes > 0
                        ? formatHoursDecimal(item.breakdown.hours_taught_minutes)
                        : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums text-slate-700">
                      {formatVND(item.calculated_amount)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums text-emerald-700">
                      {item.breakdown.bonuses > 0
                        ? `+${formatVND(item.breakdown.bonuses)}`
                        : ""}
                    </span>
                    {item.breakdown.deductions > 0 ? (
                      <span className="ml-1 tabular-nums text-rose-600">
                        −{formatVND(item.breakdown.deductions)}
                      </span>
                    ) : null}
                  </Td>
                  <Td align="right">
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatVND(item.final_amount)}
                    </span>
                  </Td>
                  <Td>
                    {canEdit ? (
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
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-amber-50/60">
              <tr className="text-sm">
                <Td>
                  <span className="font-semibold text-slate-900">TỔNG CỘNG</span>
                </Td>
                <Td align="right">
                  <span className="font-semibold tabular-nums">{totals.sessions}</span>
                </Td>
                <Td align="right">
                  <span className="font-semibold tabular-nums">
                    {totals.minutes > 0 ? formatHoursDecimal(totals.minutes) : "—"}
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
