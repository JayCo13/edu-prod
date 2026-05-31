import "server-only";

import ExcelJS from "exceljs";

import type { SchoolPayrollSummaryRow } from "./engine-actions";
import type { SchoolYearPeriodRow } from "./types";

/**
 * Xuất Excel bảng lương thừa giờ trường học — mẫu theo TT 21/2025.
 * Đầu vào: danh sách summary từ previewSchoolPayrollForAllTeachers.
 */
export async function exportSchoolPayrollExcel(params: {
  schoolYear: SchoolYearPeriodRow;
  tenantName: string;
  rows: SchoolPayrollSummaryRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Edura";
  wb.created = new Date();

  const ws = wb.addWorksheet(`Thừa giờ ${params.schoolYear.year_label}`, {
    properties: { defaultRowHeight: 20 },
  });

  // Header
  ws.mergeCells("A1:N1");
  ws.getCell("A1").value =
    `BẢNG TÍNH TIỀN LƯƠNG DẠY THÊM GIỜ — NĂM HỌC ${params.schoolYear.year_label}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:N2");
  ws.getCell("A2").value = params.tenantName;
  ws.getCell("A2").alignment = { horizontal: "center" };
  ws.getCell("A2").font = { italic: true };

  ws.mergeCells("A3:N3");
  ws.getCell("A3").value = `Khoảng thời gian: ${params.schoolYear.start_date} → ${params.schoolYear.end_date}  ·  Số tuần dạy: ${params.schoolYear.teaching_weeks}`;
  ws.getCell("A3").font = { size: 10, color: { argb: "FF666666" } };
  ws.getCell("A3").alignment = { horizontal: "center" };

  ws.addRow([]);

  // Table header
  const headers = [
    "STT",
    "Họ tên",
    "Định mức (tiết/năm)",
    "Thực dạy",
    "Bị thay",
    "Dạy thay",
    "Tổng",
    "Thừa giờ",
    "Bị cắt (>200)",
    "Đơn giá / tiết",
    "Hệ số 1.5",
    "Thành tiền thừa giờ",
    "Đã tạm ứng",
    "Quyết toán",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F4F8" },
    };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Rows
  let totalPay = 0;
  let totalAdvance = 0;
  let totalNet = 0;
  let totalOvertime = 0;
  let totalUncovered = 0;

  params.rows.forEach((r, idx) => {
    if (r.error) {
      const row = ws.addRow([
        idx + 1,
        r.teacher_name,
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
        `LỖI: ${r.error}`,
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
      return;
    }

    // Đơn giá ước tính: pay / (overtime_paid × 1.5). Có thể NaN khi
    // overtime=0 → để trống cho dễ đọc.
    const rateEstimate =
      r.overtime_paid > 0
        ? Math.round(r.overtime_total_pay_vnd / (r.overtime_paid * 1.5))
        : 0;

    const row = ws.addRow([
      idx + 1,
      r.teacher_name,
      r.quota_periods,
      r.total_actual_periods, // thực dạy (tổng thực dạy + thay - bị thay)
      "",                      // placeholder bị thay (engine không tách riêng)
      "",                      // placeholder dạy thay
      r.total_actual_periods,
      r.overtime_paid,
      r.overtime_uncovered || "",
      rateEstimate || "",
      1.5,
      r.overtime_total_pay_vnd,
      r.total_advances_vnd,
      r.net_settlement_vnd,
    ]);

    row.eachCell((cell, colNum) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      // Currency format cho cột tiền
      if ([10, 12, 13, 14].includes(colNum)) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
      // Số nguyên
      if ([1, 3, 4, 7, 8, 9].includes(colNum)) {
        cell.alignment = { horizontal: "right" };
      }
    });

    // Highlight ô bị cắt vàng + ô âm đỏ
    if (r.overtime_uncovered > 0) {
      ws.getCell(row.number, 9).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF7E6" },
      };
    }
    if (r.net_settlement_vnd < 0) {
      ws.getCell(row.number, 14).font = {
        color: { argb: "FFC53030" },
        bold: true,
      };
    }

    totalPay += r.overtime_total_pay_vnd;
    totalAdvance += r.total_advances_vnd;
    totalNet += r.net_settlement_vnd;
    totalOvertime += r.overtime_paid;
    totalUncovered += r.overtime_uncovered;
  });

  // Tổng cộng
  ws.addRow([]);
  const totalRow = ws.addRow([
    "",
    "TỔNG CỘNG",
    "",
    "",
    "",
    "",
    "",
    totalOvertime,
    totalUncovered || "",
    "",
    "",
    totalPay,
    totalAdvance,
    totalNet,
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell, colNum) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F4F8" },
    };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
    if ([12, 13, 14].includes(colNum)) {
      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
    }
  });

  // Column widths
  ws.columns = [
    { width: 6 }, // STT
    { width: 28 }, // Họ tên
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 10 },
    { width: 20 },
    { width: 16 },
    { width: 20 },
  ];

  // Note theo TT 21
  ws.addRow([]);
  const noteRow = ws.addRow([
    "Ghi chú: Lương thừa giờ tính theo TT 21/2025/TT-BGDĐT. Trần 200 tiết/năm/GV. Hệ số 1.5. Định mức theo TT 05/2025 + giảm trừ kiêm nhiệm (tối đa 2). Quyết toán âm = đã tạm ứng vượt, cần thu hồi.",
  ]);
  ws.mergeCells(noteRow.number, 1, noteRow.number, 14);
  noteRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  noteRow.getCell(1).alignment = { wrapText: true };

  ws.addRow([]);
  const footerRow = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Người lập",
    "",
    "Hiệu trưởng",
  ]);
  footerRow.font = { italic: true };
  footerRow.alignment = { horizontal: "center" };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
