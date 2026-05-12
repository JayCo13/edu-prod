/**
 * Vietnamese display formatters shared by every payroll surface.
 * Date  → DD/MM/YYYY      (PRD §7.2)
 * Money → 1.000.000đ      (PRD §7.2)
 */

export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0đ";
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export function formatDateVN(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

export function formatMonthYear(yyyyMmDd: string): string {
  const [y, m] = yyyyMmDd.split("-");
  return `${m}/${y}`;
}

export function formatHoursDecimal(minutes: number): string {
  // 2670 min → "44,5"; vi-VN locale uses comma as decimal separator.
  return (minutes / 60).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export const PAYROLL_STATUS_LABEL = {
  DRAFT: "Đang soạn",
  APPROVED: "Đã duyệt",
  PAID: "Đã thanh toán",
} as const;
