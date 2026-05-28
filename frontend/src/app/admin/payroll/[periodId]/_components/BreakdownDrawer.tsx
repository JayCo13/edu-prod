"use client";

import { X, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeAdjustmentAction } from "@/modules/payroll/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type {
  PayrollItemRow,
  PayrollPeriodStatus,
} from "@/modules/payroll/domain-types";
import {
  formatHoursDecimal,
  formatVND,
} from "@/modules/payroll/format";

interface Props {
  item: PayrollItemRow | null;
  periodId: string;
  periodStatus: PayrollPeriodStatus;
  onClose: () => void;
}

/**
 * Right-side drawer showing the full breakdown for a single teacher.
 *
 * Surface includes:
 *   - Identity (snapshot frozen at create-period time)
 *   - Stat tiles: sessions, hours, hourly/per_session/fixed components
 *   - Adjustments list with remove buttons (DRAFT only)
 *   - Audit trail (the calculator's per-step explanation)
 */
export default function BreakdownDrawer({
  item,
  periodId,
  periodStatus,
  onClose,
}: Props) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  if (!item) return null;

  const t = item.teacher_snapshot;
  const b = item.breakdown;
  const canEdit = periodStatus === "DRAFT";

  async function handleRemove(adjustmentId: string) {
    if (!item) return;
    const ok = await confirm({
      title: "Xoá điều chỉnh này?",
      variant: "danger",
      confirmLabel: "Xoá",
      description:
        "Số tiền của giáo viên sẽ được tính lại sau khi xoá. Hành động này không thể hoàn tác.",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await removeAdjustmentAction(item.id, periodId, adjustmentId);
      if (r.success) toast.success("Đã xóa điều chỉnh.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-slate-900/30 transition-opacity"
        onClick={onClose}
      />
      <aside className="w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Chi tiết bảng lương
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {t.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {paymentStructureLabel(t.payment_structure)}
              {t.mst ? ` · MST ${t.mst}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* ── Headline numbers ─────────────────────────────────── */}
          {/* The middle tile adapts to the teacher's payment structure:
              HOURLY / HYBRID care about hours; PER_SESSION cares only
              about the per-session rate × session count (session duration
              is irrelevant to pay); FIXED_MONTHLY shows the monthly base. */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Số buổi" value={String(b.sessions_paid)} />
            {t.payment_structure === "PER_SESSION" ? (
              <StatTile
                label="Đơn giá / buổi"
                value={formatVND(t.per_session_rate ?? 0)}
              />
            ) : t.payment_structure === "FIXED_MONTHLY" ? (
              <StatTile
                label="Lương cố định"
                value={formatVND(t.fixed_monthly_amount ?? 0)}
              />
            ) : (
              <StatTile
                label="Tổng giờ"
                value={
                  b.hours_taught_minutes > 0
                    ? formatHoursDecimal(b.hours_taught_minutes)
                    : "—"
                }
              />
            )}
            <StatTile label="Cơ bản" value={formatVND(b.calculated_amount)} />
            <StatTile
              label="Thực lĩnh"
              value={formatVND(item.final_amount)}
              emphasized
            />
          </section>

          {/* ── Component breakdown ──────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Cấu thành</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {b.hourly_pay > 0 ? (
                <Row
                  k={`Tiền giờ (${formatHoursDecimal(b.hours_taught_minutes)} giờ × ${formatVND(t.hourly_rate)}/giờ)`}
                  v={formatVND(b.hourly_pay)}
                />
              ) : null}
              {b.per_session_pay > 0 ? (
                <Row
                  k={`Tiền theo buổi (${b.sessions_paid} × ${formatVND(t.per_session_rate ?? 0)}/buổi)`}
                  v={formatVND(b.per_session_pay)}
                />
              ) : null}
              {b.fixed_monthly_pay > 0 ? (
                <Row k="Lương cố định tháng" v={formatVND(b.fixed_monthly_pay)} />
              ) : null}
              {b.automatic_penalties > 0 ? (
                <Row
                  k="Phạt tự động (đi trễ)"
                  v={`−${formatVND(b.automatic_penalties)}`}
                  negative
                />
              ) : null}
              <div className="border-t border-slate-100 pt-2">
                <Row
                  k="Cộng cơ bản"
                  v={formatVND(b.calculated_amount)}
                  bold
                />
              </div>
            </dl>
          </section>

          {/* ── Adjustments ──────────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Điều chỉnh thủ công
            </h3>
            {item.adjustments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Chưa có điều chỉnh nào.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {item.adjustments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        <span
                          className={
                            a.type === "BONUS"
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }
                        >
                          {a.type === "BONUS" ? "+" : "−"} {formatVND(a.amount)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{a.reason}</p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(a.id)}
                        disabled={pending}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Xóa điều chỉnh"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Audit trail ──────────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Nhật ký tính toán
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Sinh tự động bởi bộ tính lương. Dùng để đối chiếu khi có thắc mắc.
            </p>
            {item.audit_trail.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Không có dữ liệu chi tiết.
              </p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {item.audit_trail.map((entry, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                  >
                    <span className="mt-0.5 inline-block w-32 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {entry.kind}
                    </span>
                    <span className="flex-1 text-slate-700">{entry.reason}</span>
                    {entry.amount !== 0 ? (
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          entry.amount < 0 ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {formatVND(entry.amount)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function StatTile({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        emphasized
          ? "border-indigo-200 bg-indigo-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-bold tabular-nums ${
          emphasized ? "text-indigo-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  k,
  v,
  bold = false,
  negative = false,
}: {
  k: string;
  v: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">{k}</dt>
      <dd
        className={`tabular-nums ${bold ? "font-semibold" : ""} ${
          negative ? "text-rose-600" : "text-slate-900"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

function paymentStructureLabel(s: string): string {
  switch (s) {
    case "HOURLY":
      return "Lương theo giờ";
    case "PER_SESSION":
      return "Lương theo buổi";
    case "FIXED_MONTHLY":
      return "Lương cố định";
    case "HYBRID":
      return "Lương kết hợp";
    default:
      return s;
  }
}
