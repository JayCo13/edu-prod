"use client";

import ExcelJS from "exceljs";

import type {
  ClassRow,
  PeriodRow,
  SubjectRow,
  TimetableSlotRow,
} from "./types";
import type { TenantTeacherRow } from "@/types/database";

/**
 * Excel export — Vietnamese-school "Thời khoá biểu" full-grade layout.
 *
 * Mirrors the printed sheet:
 *   Header rows  : school + year + semester (left), title + shift (center)
 *   Grid header  : THỨ | TIẾT | <class1 (HR)> | <class2 (HR)> | ...
 *   Body         : 6 day-blocks × N periods each, cell = "Mã môn - GV"
 *
 * Returns a Blob the caller can FileSaver-style download.
 */

// ISO day_of_week 1-6 (Mon-Sat). Sunday excluded.
const VN_SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] as const;

function teacherAbbrev(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  return parts[parts.length - 1] || displayName;
}

function slotKey(classId: string, day: number, periodId: string): string {
  return `${classId}|${day}|${periodId}`;
}

export interface ExportTkbInput {
  centerName: string;
  yearLabel: string;
  semester: 1 | 2;
  tkbNumber: number;
  grade: number;
  classes: ClassRow[];
  /** All periods for the tenant; we split by shift internally. */
  periods: PeriodRow[];
  slots: TimetableSlotRow[];
  subjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  /** Effective date shown under the title — e.g. "Thực hiện từ ngày DD/MM/YYYY". */
  effectiveDate?: Date;
}

/** Single-sheet workbook with both Sáng + Chiều stacked vertically. Earlier
 *  versions used 2 separate worksheets, but users often opened the file and
 *  missed the second tab entirely. Stacking guarantees the full day is
 *  visible on first open. */
export async function exportTkbToExcel(input: ExportTkbInput): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Edura";
  wb.created = new Date();

  const morning = input.periods
    .filter((p) => p.shift === "SANG")
    .sort((a, b) => a.period_number - b.period_number);
  const afternoon = input.periods
    .filter((p) => p.shift === "CHIEU")
    .sort((a, b) => a.period_number - b.period_number);

  const totalCols = 2 + input.classes.length;
  const lastColLetter = getColumnLetter(totalCols);

  const ws = wb.addWorksheet(`Khối ${input.grade}`, {
    views: [{ state: "frozen", ySplit: 4, xSplit: 2 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // ── Shared file-level header ────────────────────────────────────────────
  writeFileHeader(ws, input, lastColLetter);

  // ── Section: Sáng ───────────────────────────────────────────────────────
  let nextRow = 5;
  if (morning.length > 0) {
    nextRow = writeShiftSection(ws, input, "SANG", morning, nextRow, lastColLetter);
  }
  // Spacer between shifts.
  if (morning.length > 0 && afternoon.length > 0) {
    nextRow += 1;
  }
  if (afternoon.length > 0) {
    writeShiftSection(ws, input, "CHIEU", afternoon, nextRow, lastColLetter);
  }

  if (morning.length === 0 && afternoon.length === 0) {
    ws.getCell("A5").value = "Chưa có khung tiết nào để xuất.";
  }

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 6;
  for (let i = 0; i < input.classes.length; i++) {
    ws.getColumn(3 + i).width = 13;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function getColumnLetter(col: number): string {
  // ExcelJS column letters — supports >26 columns (AA, AB, ...).
  let letter = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function writeFileHeader(
  ws: ExcelJS.Worksheet,
  input: ExportTkbInput,
  lastColLetter: string,
): void {
  const { centerName, yearLabel, semester, tkbNumber, grade, effectiveDate } =
    input;

  ws.getCell("A1").value = centerName;
  ws.getCell("A1").font = { bold: true, size: 11 };
  ws.mergeCells("A1:B1");

  ws.mergeCells(`C1:${lastColLetter}1`);
  ws.getCell("C1").value = `THỜI KHOÁ BIỂU SỐ ${tkbNumber} · KHỐI ${grade}`;
  ws.getCell("C1").font = { bold: true, size: 16 };
  ws.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell("A2").value = `Năm học ${yearLabel}`;
  ws.getCell("A2").font = { size: 10 };
  ws.mergeCells("A2:B2");

  ws.getCell("A3").value = `Học kỳ ${semester}`;
  ws.getCell("A3").font = { size: 10 };
  ws.mergeCells("A3:B3");

  if (effectiveDate) {
    ws.mergeCells(`C3:${lastColLetter}3`);
    const d = effectiveDate;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    ws.getCell("C3").value = `Thực hiện từ ngày ${dd} tháng ${mm} năm ${yy}`;
    ws.getCell("C3").font = { italic: true, size: 10 };
    ws.getCell("C3").alignment = { horizontal: "center" };
  }
}

/** Writes one shift block (header + day rows) starting at `startRow`.
 *  Returns the row index one past the last written row so the caller can
 *  stack the next section directly underneath. */
function writeShiftSection(
  ws: ExcelJS.Worksheet,
  input: ExportTkbInput,
  shift: "SANG" | "CHIEU",
  periods: PeriodRow[],
  startRow: number,
  lastColLetter: string,
): number {
  const { classes, slots, subjects, teachers } = input;

  // Shift banner row
  ws.mergeCells(`A${startRow}:${lastColLetter}${startRow}`);
  const banner = ws.getCell(`A${startRow}`);
  banner.value = `BUỔI ${shift === "SANG" ? "SÁNG" : "CHIỀU"}`;
  banner.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  banner.alignment = { horizontal: "center", vertical: "middle" };
  banner.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: shift === "SANG" ? "FF1E40AF" : "FF7C3AED" },
  };
  ws.getRow(startRow).height = 22;

  // Column header row
  const headerRowIdx = startRow + 1;
  const headerRow = ws.getRow(headerRowIdx);
  headerRow.values = [
    "THỨ",
    "TIẾT",
    ...classes.map((c) => {
      const hr = c.homeroom_teacher_id
        ? teachers.find((t) => t.id === c.homeroom_teacher_id)
        : null;
      return `${c.name}${hr ? ` (${teacherAbbrev(hr.display_name)})` : ""}`;
    }),
  ];
  headerRow.font = { bold: true, size: 9 };
  headerRow.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Index slots by (class, day, period) for fast lookup
  const slotByCell = new Map<string, TimetableSlotRow>();
  for (const s of slots) {
    slotByCell.set(`${s.class_id}|${s.day_of_week}|${s.period_id}`, s);
  }
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  const totalCols = 2 + classes.length;
  const lastPeriodNum = periods[periods.length - 1]?.period_number ?? 5;

  let rowIdx = headerRowIdx + 1;
  const dayBlockStartRows: number[] = [];

  for (const day of VN_SCHOOL_DAYS) {
    const dayBlockStart = rowIdx;
    dayBlockStartRows.push(dayBlockStart);

    for (const period of periods) {
      const row = ws.getRow(rowIdx);
      // ISO 1=Mon … 6=Sat. Vietnamese display label is `day + 1`
      // ("Thứ 2" – "Thứ 7"). Chào cờ = Mon period 1, Sinh hoạt = Sat last.
      const isFlagRaising =
        shift === "SANG" && day === 1 && period.period_number === 1;
      const isHomeroom = day === 6 && period.period_number === lastPeriodNum;

      if (rowIdx === dayBlockStart) {
        row.getCell(1).value = day + 1;
        row.getCell(1).font = { bold: true, size: 14 };
      }
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(2).value = period.period_number;
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).font = { size: 9 };

      classes.forEach((c, i) => {
        const cell = row.getCell(3 + i);
        const slot = slotByCell.get(`${c.id}|${day}|${period.id}`);
        if (slot) {
          const subject = subjectById.get(slot.subject_id);
          const teacher = slot.teacher_id
            ? teacherById.get(slot.teacher_id)
            : null;
          const code = subject?.short_code || subject?.name || "?";
          const tch = teacher ? teacherAbbrev(teacher.display_name) : "";
          cell.value = tch ? `${code} - ${tch}` : code;
        } else if (isFlagRaising) {
          cell.value = "Chào cờ";
          cell.font = { italic: true, color: { argb: "FF64748B" } };
        } else if (isHomeroom) {
          cell.value = "Sinh hoạt";
          cell.font = { italic: true, color: { argb: "FF64748B" } };
        }
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        if (!cell.font) cell.font = { size: 9 };
        else cell.font = { ...cell.font, size: 9 };
      });

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > totalCols) return;
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      });

      row.height = 22;
      rowIdx++;
    }

    // Heavier bottom border at end of each day block.
    const lastRowOfBlock = rowIdx - 1;
    for (let col = 1; col <= totalCols; col++) {
      const cell = ws.getRow(lastRowOfBlock).getCell(col);
      cell.border = {
        ...cell.border,
        bottom: { style: "medium", color: { argb: "FF000000" } },
      };
    }
  }

  // Merge the THỨ cells per day block.
  dayBlockStartRows.forEach((start) => {
    if (periods.length > 1) {
      ws.mergeCells(start, 1, start + periods.length - 1, 1);
    }
  });

  return rowIdx;
}

/** Convenience: trigger a download for the generated Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
