/**
 * Excel export — Vietnamese-school "Thời khoá biểu" timetable layout.
 *
 * Sessions are arranged as a matrix:
 *
 *           |  Cô Hà  |  Thầy Tài  |  Cô Bình  | ...
 *   ─────────────────────────────────────────────
 *   T2  6:00 |         |             |             |
 *       7:00 | 6A3-Toán|             |             |
 *       8:00 |         | 9A2-GDĐP(V) |             |
 *   ─────────────────────────────────────────────
 *   T3  6:00 |         |             | ...
 *
 * Rows are sorted by date then by start-hour; cells contain
 * "{course_title}" (with the session title as the second line if it fits).
 * Cancelled sessions render with strikethrough + grey font.
 *
 * Visual: alternating day-row band (yellow / white) like the school
 * printable; bold centered title block on top; frozen header row.
 */

import ExcelJS from "exceljs";
import type { TeacherSessionRow } from "@/app/actions/live-sessions";

const VI_WEEKDAYS_SHORT = [
  "CN",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function dayKey(d: Date): string {
  // YYYY-MM-DD — for grouping. Stable across DST since we use local parts
  // already (sessions stored as UTC + projected to local on render side
  // of the app; here we keep the device tz which is Asia/Ho_Chi_Minh for
  // VN admins).
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "15:30" key for the (day, start-time) → bucket map. Sorts naturally as
 *  a string because zero-padded HH:MM is monotonic. */
function timeKey(d: Date): string {
  return fmtTime(d);
}

/** Compact session label for a timetable cell. Mirrors the screenshot's
 *  "6A3 - Toán" pattern — short course code on top, session title under. */
function cellLabel(s: TeacherSessionRow): string {
  const course = s.course?.title?.trim() ?? "";
  const title = s.title.trim();
  if (course && title && course !== title) {
    return `${course}\n${title}`;
  }
  return course || title;
}

export interface ExportContext {
  centerName?: string;
  /** Optional range override; otherwise derived from session start times. */
  rangeLabel?: string;
}

/** Build a stable column ordering: admins first (so they're nearest the
 *  row labels), then by display_name. Sessions without an assigned teacher
 *  bucket into a single "Chưa phân công" column. */
function deriveTeacherColumns(sessions: TeacherSessionRow[]): {
  id: string;
  name: string;
  color: string;
}[] {
  const seen = new Map<
    string,
    { id: string; name: string; color: string; isAdmin: boolean }
  >();
  for (const s of sessions) {
    if (s.teacher) {
      if (!seen.has(s.teacher.id)) {
        seen.set(s.teacher.id, {
          id: s.teacher.id,
          name: s.teacher.display_name,
          color: s.teacher.color,
          isAdmin: s.teacher.is_admin,
        });
      }
    } else if (!seen.has("__unassigned__")) {
      seen.set("__unassigned__", {
        id: "__unassigned__",
        name: "Chưa phân công",
        color: "#94a3b8",
        isAdmin: false,
      });
    }
  }
  return [...seen.values()]
    .sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return a.name.localeCompare(b.name, "vi");
    })
    .map(({ id, name, color }) => ({ id, name, color }));
}

/** Group sessions by local day, then by exact start time (HH:MM). Two
 *  sessions at the same minute share a row; 15:00 and 15:30 each get
 *  their own row so the printable timetable shows real start times. */
function groupByDayAndTime(sessions: TeacherSessionRow[]): {
  dayKey: string;
  date: Date;
  times: string[]; // ["07:00", "07:30", "15:30", ...]
  /** "HH:MM" → teacherId → list of sessions in that bucket. */
  buckets: Map<string, Map<string, TeacherSessionRow[]>>;
}[] {
  const byDay = new Map<
    string,
    {
      date: Date;
      times: Set<string>;
      buckets: Map<string, Map<string, TeacherSessionRow[]>>;
    }
  >();
  for (const s of sessions) {
    const start = new Date(s.start_time);
    const k = dayKey(start);
    const t = timeKey(start);
    let entry = byDay.get(k);
    if (!entry) {
      entry = { date: start, times: new Set(), buckets: new Map() };
      byDay.set(k, entry);
    }
    entry.times.add(t);
    let timeBucket = entry.buckets.get(t);
    if (!timeBucket) {
      timeBucket = new Map();
      entry.buckets.set(t, timeBucket);
    }
    const teacherId = s.teacher?.id ?? "__unassigned__";
    const list = timeBucket.get(teacherId) ?? [];
    list.push(s);
    timeBucket.set(teacherId, list);
  }
  return [...byDay.entries()]
    .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
    .map(([k, v]) => ({
      dayKey: k,
      date: v.date,
      // String sort works because HH:MM is zero-padded → monotonic.
      times: [...v.times].sort(),
      buckets: v.buckets,
    }));
}

const FIXED_COLS = 2; // NGÀY + GIỜ
const BAND_FILL_LIGHT = "FFFEF9C3"; // yellow-100
const BAND_FILL_HEAVY = "FFFEF08A"; // yellow-200 — for the day-label cell
const HEADER_FILL = "FF1E293B"; // slate-900

export async function exportSessionsToExcel(
  sessions: TeacherSessionRow[],
  filename: string,
  context: ExportContext = {},
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VLearning";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Thời khoá biểu", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const teachers = deriveTeacherColumns(sessions);
  const groups = groupByDayAndTime(sessions);
  const totalCols = FIXED_COLS + teachers.length;

  // ── Column widths ──────────────────────────────────────────────────
  sheet.getColumn(1).width = 14; // NGÀY label
  sheet.getColumn(2).width = 8; // GIỜ
  teachers.forEach((_, i) => {
    sheet.getColumn(FIXED_COLS + 1 + i).width = 22;
  });

  // ── Title block (rows 1–3) ─────────────────────────────────────────
  const lastColLetter = sheet.getColumn(totalCols).letter;

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "THỜI KHOÁ BIỂU";
  titleCell.font = { bold: true, size: 18, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = context.centerName
    ? `Trung tâm: ${context.centerName}`
    : "";
  subtitleCell.font = { bold: true, size: 11, color: { argb: "FF334155" } };
  subtitleCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 18;

  sheet.mergeCells(`A3:${lastColLetter}3`);
  const rangeCell = sheet.getCell("A3");
  const computedRange = ((): string => {
    if (context.rangeLabel) return context.rangeLabel;
    if (sessions.length === 0) return "";
    const times = sessions.map((s) => new Date(s.start_time).getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    if (formatDate(min) === formatDate(max)) {
      return `Ngày ${formatDate(min)}`;
    }
    return `Từ ${formatDate(min)} đến ${formatDate(max)}`;
  })();
  rangeCell.value = computedRange;
  rangeCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  rangeCell.alignment = { horizontal: "center" };
  sheet.getRow(3).height = 16;

  // Row 4: spacer (blank, white).

  // ── Header row (row 5) ─────────────────────────────────────────────
  const headerRowNum = 5;
  const headerRow = sheet.getRow(headerRowNum);
  headerRow.getCell(1).value = "NGÀY";
  headerRow.getCell(2).value = "GIỜ";
  teachers.forEach((t, i) => {
    headerRow.getCell(FIXED_COLS + 1 + i).value = t.name;
  });
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 26;

  // ── Data rows ──────────────────────────────────────────────────────
  if (groups.length === 0) {
    // Empty state — a single explanatory row.
    const r = sheet.getRow(headerRowNum + 1);
    sheet.mergeCells(`A${headerRowNum + 1}:${lastColLetter}${headerRowNum + 1}`);
    r.getCell(1).value = "Không có buổi học nào trong khoảng thời gian này.";
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
  } else {
    let currentRowNum = headerRowNum + 1;
    let zebra = false;

    for (const group of groups) {
      const dayLabel = `${VI_WEEKDAYS_SHORT[group.date.getDay()]}\n${formatDate(group.date)}`;
      const startRow = currentRowNum;
      const endRow = currentRowNum + group.times.length - 1;

      // Merge the NGÀY label cell vertically across this day's rows.
      sheet.mergeCells(`A${startRow}:A${endRow}`);
      const labelCell = sheet.getCell(`A${startRow}`);
      labelCell.value = dayLabel;
      labelCell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      labelCell.font = { bold: true, color: { argb: "FF0F172A" } };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BAND_FILL_HEAVY },
      };
      labelCell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FF334155" } },
      };

      for (const time of group.times) {
        const row = sheet.getRow(currentRowNum);
        row.height = 36;

        // Time column — exact HH:MM (e.g. "15:30"), not hour-truncated.
        // Include the end time for the first session in this bucket so
        // admins reading a printed sheet see the full session span.
        const timeCell = row.getCell(2);
        const sampleBucket = group.buckets.get(time);
        const firstSession = sampleBucket
          ? [...sampleBucket.values()][0]?.[0]
          : null;
        if (firstSession) {
          const start = new Date(firstSession.start_time);
          const end = new Date(
            start.getTime() + firstSession.duration_minutes * 60_000,
          );
          timeCell.value = `${time}\n${fmtTime(end)}`;
        } else {
          timeCell.value = time;
        }
        timeCell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        timeCell.font = {
          color: { argb: "FF334155" },
          name: "Consolas",
          size: 11,
        };
        if (zebra) {
          timeCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: BAND_FILL_LIGHT },
          };
        }

        // Per-teacher cells
        const timeBucket = group.buckets.get(time);
        teachers.forEach((t, i) => {
          const cell = row.getCell(FIXED_COLS + 1 + i);
          const list = timeBucket?.get(t.id) ?? [];
          if (list.length === 0) {
            cell.value = "";
          } else {
            // Two sessions at exactly the same minute for the same teacher
            // shouldn't happen in practice, but join defensively.
            const text = list.map((s) => cellLabel(s)).join("\n────\n");
            cell.value = text;
            const cancelled = list.every((s) => s.is_cancelled);
            cell.font = cancelled
              ? {
                  color: { argb: "FF94A3B8" },
                  strike: true,
                  size: 10,
                }
              : {
                  color: { argb: "FF0F172A" },
                  bold: true,
                  size: 10,
                };
          }
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          if (zebra) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: BAND_FILL_LIGHT },
            };
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });

        // Time cell border too
        timeCell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        currentRowNum += 1;
      }

      // Heavy bottom border on the last row of the day section so it
      // visually separates from the next day.
      const lastRow = sheet.getRow(endRow);
      lastRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          ...cell.border,
          bottom: { style: "medium", color: { argb: "FF334155" } },
        };
      });

      zebra = !zebra; // alternate band per day
    }

    // ── Summary footer ─────────────────────────────────────────────
    const footerRow = currentRowNum + 1;
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce(
      (s, x) => (x.is_cancelled ? s : s + x.duration_minutes),
      0,
    );
    const totalHours = (totalMinutes / 60).toLocaleString("vi-VN", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    sheet.mergeCells(`A${footerRow}:${lastColLetter}${footerRow}`);
    const footerCell = sheet.getCell(`A${footerRow}`);
    footerCell.value = `TỔNG CỘNG: ${totalSessions} buổi · ${totalHours} giờ · ${teachers.length} giáo viên`;
    footerCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    footerCell.alignment = { horizontal: "center" };
    footerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    sheet.getRow(footerRow).height = 22;
  }

  // ── Borders on header row + side columns ──────────────────────────
  for (let c = 1; c <= totalCols; c++) {
    const cell = sheet.getRow(headerRowNum).getCell(c);
    cell.border = {
      top: { style: "medium", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF1E293B" } },
      right: { style: "thin", color: { argb: "FF1E293B" } },
      bottom: { style: "medium", color: { argb: "FF334155" } },
    };
  }

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
