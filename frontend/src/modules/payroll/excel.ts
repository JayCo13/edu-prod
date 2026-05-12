/**
 * Payroll Excel exporter — Vietnamese accounting standard.
 *
 * Spec (cycle 6 brief + PRD §5.8 acceptance):
 *   - Header: BẢNG LƯƠNG THÁNG MM/YYYY + center name + address
 *   - Columns: STT | Họ tên | MST | Số giờ | Đơn giá | Thành tiền
 *              | Phụ cấp | Khấu trừ | Thực lĩnh | Ký nhận
 *   - Currency: 1.000.000đ (dot separator + "đ" suffix)
 *   - Date: DD/MM/YYYY
 *   - Total row at bottom
 *
 * The number format `'#,##0"đ"'` renders as `1.000.000đ` under
 * Vietnamese Excel locale (which Vietnamese accountants run). Under
 * English locale it would render `1,000,000đ` — acceptable degradation.
 *
 * exceljs is already in deps from the old course-export module.
 */

import ExcelJS from "exceljs";
import type { PayrollItemRow, PayrollPeriodRow } from "./domain-types";

// ─── Named constants ─────────────────────────────────────────────────────────

const MINUTES_PER_HOUR = 60;
/** Excel number format for VND amounts. Locale-dependent thousand separator. */
const VND_FORMAT = '#,##0"đ"';
/** Excel number format for decimal hours (44,5). */
const HOURS_FORMAT = "#,##0.0";

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ExportCenterInfo {
  name: string;
  address: string;
}

/**
 * Build a workbook. Caller serializes (to file or buffer).
 *
 * NOTE: returns the exceljs Workbook so the Route Handler can stream as
 * Buffer, and the seed script can call `workbook.xlsx.writeFile(path)`.
 */
export function buildPayrollWorkbook(input: {
  period: PayrollPeriodRow;
  items: PayrollItemRow[];
  center: ExportCenterInfo;
}): ExcelJS.Workbook {
  const { period, items, center } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = "VLearning";
  wb.created = new Date();

  const ws = wb.addWorksheet("Bảng lương", {
    pageSetup: { paperSize: 9, orientation: "landscape" }, // A4 landscape
    views: [{ showGridLines: false }],
  });

  // ── Header block ──────────────────────────────────────────────────
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `BẢNG LƯƠNG THÁNG ${formatMonthYear(period.period_start)}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:J2");
  const centerNameCell = ws.getCell("A2");
  centerNameCell.value = center.name;
  centerNameCell.font = { name: "Calibri", size: 12, bold: true };
  centerNameCell.alignment = { horizontal: "center" };

  ws.mergeCells("A3:J3");
  const addressCell = ws.getCell("A3");
  addressCell.value = center.address || "";
  addressCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF555555" } };
  addressCell.alignment = { horizontal: "center" };

  ws.mergeCells("A4:J4");
  const periodCell = ws.getCell("A4");
  periodCell.value = `Kỳ lương: ${formatDateVN(period.period_start)} – ${formatDateVN(period.period_end)}`;
  periodCell.font = { name: "Calibri", size: 10, color: { argb: "FF555555" } };
  periodCell.alignment = { horizontal: "center" };

  ws.addRow([]); // spacer

  // ── Column headers ────────────────────────────────────────────────
  const headerRow = ws.addRow([
    "STT",
    "Họ tên",
    "MST",
    "Số giờ",
    "Đơn giá",
    "Thành tiền",
    "Phụ cấp",
    "Khấu trừ",
    "Thực lĩnh",
    "Ký nhận",
  ]);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = thinBorder();
  });

  ws.columns = [
    { width: 5 }, // STT
    { width: 28 }, // Họ tên
    { width: 14 }, // MST
    { width: 10 }, // Số giờ
    { width: 22 }, // Đơn giá
    { width: 18 }, // Thành tiền
    { width: 14 }, // Phụ cấp
    { width: 14 }, // Khấu trừ
    { width: 18 }, // Thực lĩnh
    { width: 18 }, // Ký nhận
  ];

  // ── Data rows ─────────────────────────────────────────────────────
  let totalBase = 0;
  let totalBonus = 0;
  let totalDeduction = 0;
  let totalFinal = 0;

  items.forEach((item, idx) => {
    const t = item.teacher_snapshot;
    const hoursDecimal = item.breakdown.hours_taught_minutes / MINUTES_PER_HOUR;

    const row = ws.addRow([
      idx + 1,
      t.name,
      t.mst ?? "-",
      // Số giờ — show only for HOURLY / HYBRID
      t.payment_structure === "HOURLY" || t.payment_structure === "HYBRID"
        ? hoursDecimal
        : "-",
      // Đơn giá — text varies by structure
      formatUnitRate(t),
      item.calculated_amount,
      item.breakdown.bonuses,
      item.breakdown.deductions,
      item.final_amount,
      "", // Ký nhận — pen-and-paper signature column
    ]);

    row.alignment = { vertical: "middle" };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(4).numFmt = HOURS_FORMAT;
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(6).numFmt = VND_FORMAT;
    row.getCell(7).numFmt = VND_FORMAT;
    row.getCell(8).numFmt = VND_FORMAT;
    row.getCell(9).numFmt = VND_FORMAT;
    row.getCell(9).font = { bold: true };
    row.eachCell((cell) => {
      cell.border = thinBorder();
    });

    totalBase += item.calculated_amount;
    totalBonus += item.breakdown.bonuses;
    totalDeduction += item.breakdown.deductions;
    totalFinal += item.final_amount;
  });

  // ── Totals row ────────────────────────────────────────────────────
  const totalRow = ws.addRow([
    "",
    "TỔNG CỘNG",
    "",
    "",
    "",
    totalBase,
    totalBonus,
    totalDeduction,
    totalFinal,
    "",
  ]);
  ws.mergeCells(`A${totalRow.number}:E${totalRow.number}`);
  const totalLabel = ws.getCell(`A${totalRow.number}`);
  totalLabel.value = "TỔNG CỘNG";
  totalLabel.alignment = { horizontal: "right", vertical: "middle" };
  totalRow.font = { bold: true };
  totalRow.getCell(6).numFmt = VND_FORMAT;
  totalRow.getCell(7).numFmt = VND_FORMAT;
  totalRow.getCell(8).numFmt = VND_FORMAT;
  totalRow.getCell(9).numFmt = VND_FORMAT;
  totalRow.eachCell((cell) => {
    cell.border = thinBorder();
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
  });

  // ── Footer (export timestamp + signature blocks) ──────────────────
  ws.addRow([]);
  const exportedRow = ws.addRow([
    `Ngày xuất: ${formatDateVN(new Date().toISOString().slice(0, 10))}`,
  ]);
  ws.mergeCells(`A${exportedRow.number}:J${exportedRow.number}`);
  exportedRow.getCell(1).font = { italic: true, color: { argb: "FF555555" } };
  exportedRow.getCell(1).alignment = { horizontal: "right" };

  ws.addRow([]);
  const sigRow = ws.addRow([
    "",
    "Người lập",
    "",
    "",
    "Kế toán",
    "",
    "",
    "Giám đốc",
    "",
    "",
  ]);
  ws.mergeCells(`B${sigRow.number}:C${sigRow.number}`);
  ws.mergeCells(`E${sigRow.number}:F${sigRow.number}`);
  ws.mergeCells(`H${sigRow.number}:I${sigRow.number}`);
  sigRow.font = { bold: true };
  sigRow.alignment = { horizontal: "center" };

  return wb;
}

/**
 * Convenience wrapper that returns a Uint8Array — works as a Web
 * `BodyInit` for NextResponse and as a buffer for `fs.writeFile`.
 */
export async function buildPayrollBuffer(
  input: Parameters<typeof buildPayrollWorkbook>[0],
): Promise<Uint8Array> {
  const wb = buildPayrollWorkbook(input);
  const arr = await wb.xlsx.writeBuffer();
  return new Uint8Array(arr as ArrayBuffer);
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatMonthYear(yyyyMmDd: string): string {
  const [y, m] = yyyyMmDd.split("-");
  return `${m}/${y}`;
}

function formatDateVN(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

/** Vietnamese unit-rate label per payment structure (PRD §5.3). */
function formatUnitRate(t: PayrollItemRow["teacher_snapshot"]): string {
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  switch (t.payment_structure) {
    case "HOURLY":
      return `${fmt(t.hourly_rate)}đ/giờ`;
    case "PER_SESSION":
      return `${fmt(t.per_session_rate ?? 0)}đ/buổi`;
    case "FIXED_MONTHLY":
      return `${fmt(t.fixed_monthly_amount ?? 0)}đ/tháng`;
    case "HYBRID": {
      const parts: string[] = [];
      if (t.fixed_monthly_amount)
        parts.push(`${fmt(t.fixed_monthly_amount)}đ/tháng`);
      if (t.hourly_rate) parts.push(`${fmt(t.hourly_rate)}đ/giờ`);
      if (t.per_session_rate)
        parts.push(`${fmt(t.per_session_rate)}đ/buổi`);
      return parts.join(" + ") || "-";
    }
  }
}

function thinBorder(): ExcelJS.Borders {
  const style: ExcelJS.Border = { style: "thin", color: { argb: "FFCBD5E1" } };
  return { top: style, left: style, bottom: style, right: style } as ExcelJS.Borders;
}
