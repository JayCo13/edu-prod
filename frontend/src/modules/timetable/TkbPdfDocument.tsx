// NOTE: NOT "use client" — this module is imported by both the editor (client)
// and the public PDF route handler (server) so font registration must work
// in both contexts.

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type {
  ClassRow,
  PeriodRow,
  SubjectRow,
  TimetableSlotRow,
} from "./types";
import type { TenantTeacherRow } from "@/types/database";

/**
 * TKB PDF — replaces the browser-print pipeline.
 *
 * React-PDF renders directly to a PDF blob client-side, so the output is
 * pixel-perfect and predictable across browsers (no @media print quirks,
 * no rowspan/overflow bugs, no dialog leakage). One A4 landscape page per
 * shift; multi-page is automatic if a shift can't fit.
 *
 * Font: Roboto from Google Fonts (supports Vietnamese diacritics). Loaded
 * lazily when the document is rendered.
 */

let fontsRegistered = false;

/**
 * Register Roboto for React-PDF.
 *
 * - Browser: `src` is a `${origin}/fonts/...` URL; React-PDF `fetch`es it.
 * - Server (PDF route): caller passes a base URL or absolute file URL
 *   string explicitly so we don't need `window`.
 */
export function ensureFonts(baseUrl?: string) {
  if (fontsRegistered) return;
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${origin}/fonts/roboto-regular.ttf`, fontWeight: "normal" },
      { src: `${origin}/fonts/roboto-bold.ttf`, fontWeight: "bold" },
      {
        src: `${origin}/fonts/roboto-italic.ttf`,
        fontWeight: "normal",
        fontStyle: "italic",
      },
    ],
  });
  fontsRegistered = true;
}

// ISO day_of_week 1-6 (Mon-Sat). Sunday excluded.
const VN_SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] as const;

function teacherAbbrev(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  return parts[parts.length - 1] || displayName;
}

function slotKey(classId: string, day: number, periodId: string): string {
  return `${classId}|${day}|${periodId}`;
}

interface TkbPdfProps {
  centerName: string;
  yearLabel: string;
  semester: 1 | 2;
  tkbNumber: number;
  grade: number;
  classes: ClassRow[];
  periods: PeriodRow[];
  slots: TimetableSlotRow[];
  subjects: SubjectRow[];
  teachers: TenantTeacherRow[];
  effectiveDate?: Date;
}

const COLORS = {
  black: "#0F172A",
  border: "#94A3B8",
  borderHeavy: "#0F172A",
  bg: "#F1F5F9",
  bgSubtle: "#F8FAFC",
  muted: "#64748B",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    padding: 16,
    paddingTop: 12,
    fontSize: 8,
    fontFamily: "Roboto",
    color: COLORS.black,
  },

  // ── Header band ───────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHeavy,
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.3,
  },
  headerLeftName: { fontWeight: 700, fontSize: 9 },
  headerCenter: {
    flex: 2,
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
  },
  headerSubtitle: {
    fontWeight: 700,
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerMeta: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 1,
  },
  headerRight: { flex: 1 },

  // ── Table ──────────────────────────────────────────────────────────────
  table: { width: "100%" },
  thRow: {
    flexDirection: "row",
    backgroundColor: COLORS.bg,
  },
  th: {
    borderWidth: 0.5,
    borderColor: COLORS.borderHeavy,
    padding: 2,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
    justifyContent: "center",
  },
  thClassName: { fontWeight: 700, fontSize: 9 },
  thHomeroom: { fontWeight: 700, fontSize: 8, marginTop: 1 },

  // Day-block container — horizontal flex: [THỨ left] + [periods stack right]
  dayBlock: {
    flexDirection: "row",
  },
  // Cells
  bodyRow: {
    flexDirection: "row",
  },
  bodyRowDayLast: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.borderHeavy,
  },
  /** Tall THỨ cell that spans the full day-block height (replaces rowSpan). */
  thuCellTall: {
    borderWidth: 0.5,
    borderColor: COLORS.borderHeavy,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  thuCell: {
    borderWidth: 0.5,
    borderColor: COLORS.borderHeavy,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  thuCellText: {
    fontWeight: 700,
    fontSize: 11,
  },
  tietCell: {
    borderWidth: 0.5,
    borderColor: COLORS.borderHeavy,
    backgroundColor: COLORS.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
  },
  cell: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: {
    fontSize: 7.5,
    color: COLORS.black,
    textAlign: "center",
  },
  cellTextSpecial: {
    fontSize: 7.5,
    fontStyle: "italic" as const,
    color: COLORS.muted,
    textAlign: "center",
  },
  cellTextEmpty: { fontSize: 7, color: "#CBD5E1", textAlign: "center" },
});

export function TkbPdfDocument(props: TkbPdfProps) {
  ensureFonts();
  const {
    centerName,
    yearLabel,
    semester,
    tkbNumber,
    grade,
    classes,
    periods,
    slots,
    subjects,
    teachers,
    effectiveDate,
  } = props;

  // Filter into shifts
  const morning = periods
    .filter((p) => p.shift === "SANG")
    .sort((a, b) => a.period_number - b.period_number);
  const afternoon = periods
    .filter((p) => p.shift === "CHIEU")
    .sort((a, b) => a.period_number - b.period_number);

  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, "vi", { numeric: true }),
  );

  // Indexes
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const slotByCell = new Map<string, TimetableSlotRow>();
  for (const s of slots) {
    slotByCell.set(slotKey(s.class_id, s.day_of_week, s.period_id), s);
  }

  return (
    <Document>
      {morning.length > 0 && (
        <ShiftPage
          shift="SÁNG"
          centerName={centerName}
          yearLabel={yearLabel}
          semester={semester}
          tkbNumber={tkbNumber}
          grade={grade}
          classes={sortedClasses}
          periods={morning}
          subjectById={subjectById}
          teacherById={teacherById}
          slotByCell={slotByCell}
          effectiveDate={effectiveDate}
        />
      )}
      {afternoon.length > 0 && (
        <ShiftPage
          shift="CHIỀU"
          centerName={centerName}
          yearLabel={yearLabel}
          semester={semester}
          tkbNumber={tkbNumber}
          grade={grade}
          classes={sortedClasses}
          periods={afternoon}
          subjectById={subjectById}
          teacherById={teacherById}
          slotByCell={slotByCell}
          effectiveDate={effectiveDate}
        />
      )}
    </Document>
  );
}

function ShiftPage({
  shift,
  centerName,
  yearLabel,
  semester,
  tkbNumber,
  grade,
  classes,
  periods,
  subjectById,
  teacherById,
  slotByCell,
  effectiveDate,
}: {
  shift: "SÁNG" | "CHIỀU";
  centerName: string;
  yearLabel: string;
  semester: 1 | 2;
  tkbNumber: number;
  grade: number;
  classes: ClassRow[];
  periods: PeriodRow[];
  subjectById: Map<string, SubjectRow>;
  teacherById: Map<string, TenantTeacherRow>;
  slotByCell: Map<string, TimetableSlotRow>;
  effectiveDate?: Date;
}) {
  // Column widths: THỨ + TIẾT + N class columns. Tweak: leave row labels
  // small (~5% each) so class columns get the lion's share.
  const labelW = 4;
  const classW = (100 - labelW * 2) / Math.max(1, classes.length);
  const lastPeriodNumber = periods[periods.length - 1]?.period_number ?? 5;

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* Header */}
      <View style={styles.headerRow} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLeftName}>{centerName}</Text>
          <Text>Năm học {yearLabel}</Text>
          <Text>Học kỳ {semester}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            THỜI KHOÁ BIỂU SỐ {tkbNumber}
          </Text>
          <Text style={styles.headerSubtitle}>BUỔI {shift}</Text>
          <Text style={styles.headerMeta}>
            Khối {grade} · {classes.length} lớp
            {effectiveDate
              ? ` · Thực hiện từ ${effectiveDate.getDate()}/${effectiveDate.getMonth() + 1}/${effectiveDate.getFullYear()}`
              : ""}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Table */}
      <View style={styles.table}>
        {/* Class headers row (repeats on each new page via `fixed`). */}
        <View style={styles.thRow} fixed>
          <View style={[styles.th, { width: `${labelW}%` }]}>
            <Text>THỨ</Text>
          </View>
          <View style={[styles.th, { width: `${labelW}%` }]}>
            <Text>TIẾT</Text>
          </View>
          {classes.map((c) => {
            const hr = c.homeroom_teacher_id
              ? teacherById.get(c.homeroom_teacher_id)
              : null;
            return (
              <View
                key={c.id}
                style={[styles.th, { width: `${classW}%` }]}
              >
                <Text style={styles.thClassName}>{c.name}</Text>
                <Text style={styles.thHomeroom}>
                  ({hr ? teacherAbbrev(hr.display_name) : "—"})
                </Text>
              </View>
            );
          })}
        </View>

        {/* Body — each day block is a single horizontal row at the day
            level: [THỨ cell tall left] + [stack of period rows on right].
            React-PDF has no native rowSpan, so we structure the layout to
            create the same visual effect (single bordered cell on the
            left, spanning the full height of the day's period rows). */}
        {VN_SCHOOL_DAYS.map((day) => (
          <View
            key={day}
            wrap={false}
            style={[
              styles.dayBlock,
              {
                // Heavier bottom rule between day blocks for readability.
                borderBottomWidth: 1.5,
                borderBottomColor: COLORS.borderHeavy,
              },
            ]}
          >
            {/* Left — single tall THỨ cell. */}
            <View style={[styles.thuCellTall, { width: `${labelW}%` }]}>
              <Text style={styles.thuCellText}>{day + 1}</Text>
            </View>

            {/* Right — stack of period rows. Width = remaining 96%. */}
            <View style={{ width: `${100 - labelW}%` }}>
              {periods.map((p) => {
                const isFlagRaising =
                  shift === "SÁNG" && day === 1 && p.period_number === 1;
                const isHomeroom =
                  day === 6 && p.period_number === lastPeriodNumber;
                // Widths inside the right container are relative to its
                // 96%. TIẾT = labelW%-of-total → labelW/(100-labelW) of
                // inner. Class widths share the remainder.
                const tietWInner = (labelW / (100 - labelW)) * 100;
                const classWInner =
                  (100 - tietWInner) / Math.max(1, classes.length);
                return (
                  <View key={`${day}-${p.id}`} style={styles.bodyRow}>
                    <View
                      style={[
                        styles.tietCell,
                        { width: `${tietWInner}%` },
                      ]}
                    >
                      <Text>{p.period_number}</Text>
                    </View>
                    {classes.map((c) => {
                      const slot = slotByCell.get(slotKey(c.id, day, p.id));
                      const subject = slot
                        ? subjectById.get(slot.subject_id)
                        : null;
                      const teacher = slot?.teacher_id
                        ? teacherById.get(slot.teacher_id)
                        : null;

                      let text = "·";
                      let textStyle = styles.cellTextEmpty;
                      if (slot) {
                        const code =
                          subject?.short_code ||
                          subject?.name ||
                          `?${slot.subject_id.slice(0, 4)}`;
                        const tch = teacher
                          ? teacherAbbrev(teacher.display_name)
                          : "";
                        text = tch ? `${code} - ${tch}` : code;
                        textStyle = styles.cellText;
                      } else if (isFlagRaising) {
                        text = "Chào cờ";
                        textStyle = styles.cellTextSpecial;
                      } else if (isHomeroom) {
                        text = "Sinh hoạt";
                        textStyle = styles.cellTextSpecial;
                      }

                      return (
                        <View
                          key={c.id}
                          style={[
                            styles.cell,
                            { width: `${classWInner}%` },
                          ]}
                        >
                          <Text style={textStyle}>{text}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

/** Generate a PDF Blob (browser context). Caller is responsible for triggering
 *  a download (via the shared `downloadBlob` helper in excel-export.ts). */
export async function renderTkbPdfBlob(props: TkbPdfProps): Promise<Blob> {
  ensureFonts();
  const instance = pdf(<TkbPdfDocument {...props} />);
  return await instance.toBlob();
}
