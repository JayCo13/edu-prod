/**
 * Excel export for teacher live sessions.
 * Uses ExcelJS so .xlsx is real (not CSV). UTF-8 throughout — Vietnamese
 * diacritics survive the round-trip into Microsoft Excel / Google Sheets.
 */

import ExcelJS from "exceljs";
import type { TeacherSessionRow } from "@/app/actions/live-sessions";

export type SessionExportStatus =
  | "Sắp tới"
  | "Đang diễn ra"
  | "Đã kết thúc"
  | "Đã hủy";

const VI_WEEKDAYS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function statusOf(s: TeacherSessionRow, now: number): SessionExportStatus {
  if (s.is_cancelled) return "Đã hủy";
  const start = new Date(s.start_time).getTime();
  const end = start + s.duration_minutes * 60 * 1000;
  if (now < start) return "Sắp tới";
  if (now <= end) return "Đang diễn ra";
  return "Đã kết thúc";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface ColumnSpec {
  header: string;
  key: string;
  width: number;
}

const COLUMNS: ColumnSpec[] = [
  { header: "Ngày", key: "date", width: 12 },
  { header: "Thứ", key: "weekday", width: 10 },
  { header: "Bắt đầu", key: "startTime", width: 10 },
  { header: "Thời lượng (phút)", key: "duration", width: 16 },
  { header: "Giáo viên", key: "teacher", width: 22 },
  { header: "Khóa học", key: "course", width: 30 },
  { header: "Tên buổi", key: "title", width: 36 },
  { header: "Đường dẫn phòng họp", key: "url", width: 50 },
  { header: "Mật khẩu", key: "password", width: 14 },
  { header: "Trạng thái", key: "status", width: 14 },
  { header: "Ghi chú", key: "description", width: 40 },
];

export async function exportSessionsToExcel(
  sessions: TeacherSessionRow[],
  filename: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VLearning";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Lịch dạy", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = COLUMNS;

  // Header row styling — bold + slate background.
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  const now = Date.now();

  // Sort: upcoming/live first (chronological), then ended (chronological).
  const sorted = [...sessions].sort((a, b) => {
    const aStart = new Date(a.start_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    return aStart - bStart;
  });

  for (const s of sorted) {
    const start = new Date(s.start_time);
    const status = statusOf(s, now);
    sheet.addRow({
      date: formatDate(start),
      weekday: VI_WEEKDAYS[start.getDay()],
      startTime: formatTime(start),
      duration: s.duration_minutes,
      teacher: s.teacher?.display_name ?? "—",
      course: s.course?.title ?? "—",
      title: s.title,
      url: s.meeting_url,
      password: s.meeting_password ?? "",
      status,
      description: s.description ?? "",
    });
  }

  // Style data rows: vertical center, wrap long fields, hyperlink the URL.
  sheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
    if (rowIndex === 1) return;
    row.alignment = { vertical: "middle", wrapText: true };
    const urlCell = row.getCell("url");
    const urlValue = urlCell.value;
    if (typeof urlValue === "string" && urlValue.length > 0) {
      urlCell.value = { text: urlValue, hyperlink: urlValue };
      urlCell.font = { color: { argb: "FF2563EB" }, underline: true };
    }

    // Status color chip (font color only; keeps file lightweight).
    const statusCell = row.getCell("status");
    const statusValue = statusCell.value as string;
    const colorMap: Record<string, string> = {
      "Sắp tới": "FF4F46E5",
      "Đang diễn ra": "FFE11D48",
      "Đã kết thúc": "FF64748B",
      "Đã hủy": "FF94A3B8",
    };
    if (statusValue && colorMap[statusValue]) {
      statusCell.font = { bold: true, color: { argb: colorMap[statusValue] } };
    }
  });

  // Trigger download.
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
