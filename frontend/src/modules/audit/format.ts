/**
 * Audit log → Vietnamese natural-language renderer.
 *
 * Pure function. Pattern-matches on `action` and pulls fields from
 * metadata / before / after. Falls back to a generic line for unknown
 * actions so future modules don't crash the modal.
 *
 * Output examples:
 *   "Anh Tuấn đã thêm phụ cấp 500.000đ cho Cô Linh lúc 14:30 ngày 12/05/2026.
 *    Lý do: thưởng chuyên cần."
 *   "Anh Tuấn đã duyệt kỳ lương lúc 09:15 ngày 13/05/2026."
 *   "Anh Tuấn đã đánh dấu kỳ lương đã thanh toán lúc 17:42 ngày 14/05/2026."
 */

import type { AuditLogRow } from "./types";

const FALLBACK_ACTOR = "Một quản trị viên";

export function renderAuditLine(entry: AuditLogRow): string {
  const actor = entry.metadata.actor_name ?? FALLBACK_ACTOR;
  const ts = formatTimestampVN(entry.created_at);

  switch (entry.action) {
    case "payroll.adjustment.add":
      return renderAdjustmentAdd(entry, actor, ts);
    case "payroll.adjustment.remove":
      return renderAdjustmentRemove(entry, actor, ts);
    case "payroll.period.approve":
      return `${actor} đã duyệt kỳ lương lúc ${ts}.`;
    case "payroll.period.mark_paid":
      return `${actor} đã đánh dấu kỳ lương đã thanh toán lúc ${ts}.`;
    default:
      return `${actor} đã thực hiện hành động \`${entry.action}\` lúc ${ts}.`;
  }
}

function renderAdjustmentAdd(
  entry: AuditLogRow,
  actor: string,
  ts: string,
): string {
  const target = entry.metadata.target_name ?? "một giáo viên";
  const kind = entry.metadata.adjustment_type === "DEDUCTION" ? "khấu trừ" : "phụ cấp";
  const amount = formatVND(entry.metadata.amount ?? 0);
  const reason = entry.metadata.reason
    ? ` Lý do: ${entry.metadata.reason}.`
    : "";
  return `${actor} đã thêm ${kind} ${amount} cho ${target} lúc ${ts}.${reason}`;
}

function renderAdjustmentRemove(
  entry: AuditLogRow,
  actor: string,
  ts: string,
): string {
  const target = entry.metadata.target_name ?? "một giáo viên";
  const kind = entry.metadata.adjustment_type === "DEDUCTION" ? "khấu trừ" : "phụ cấp";
  const amount = formatVND(entry.metadata.amount ?? 0);
  return `${actor} đã xóa ${kind} ${amount} của ${target} lúc ${ts}.`;
}

// ─── Formatting helpers (kept local — payroll has its own copy) ──────────────

function formatVND(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

/**
 * "HH:mm ngày DD/MM/YYYY" in Asia/Ho_Chi_Minh, matching the user spec.
 * Uses Intl with explicit tz so the rendered string matches what the
 * accountant would have seen on the wall clock when the event happened.
 */
export function formatTimestampVN(iso: string): string {
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${timeFmt.format(d)} ngày ${dateFmt.format(d)}`;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "payroll.adjustment.add": "Thêm điều chỉnh",
  "payroll.adjustment.remove": "Xóa điều chỉnh",
  "payroll.period.approve": "Duyệt kỳ lương",
  "payroll.period.mark_paid": "Đánh dấu đã thanh toán",
};
