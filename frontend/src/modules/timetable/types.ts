/**
 * Timetable module types — mirror the Postgres schema in migration 0029.
 *
 * Distinct from `live_sessions`: the timetable is a fixed weekly TEMPLATE.
 * A future "generate sessions from timetable" flow projects these slots
 * into concrete live_sessions for a date range (attendance + payroll then
 * consume those instances as today).
 */

export type PeriodShift = "SANG" | "CHIEU";

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ClassRow {
  id: string;
  tenant_id: string;
  name: string;
  grade_level: number | null;
  year_label: string;
  homeroom_teacher_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectRow {
  id: string;
  tenant_id: string;
  name: string;
  short_code: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeriodRow {
  id: string;
  tenant_id: string;
  shift: PeriodShift;
  period_number: number;
  /** "HH:MM:SS" returned by Postgres TIME — we slice to HH:MM at display time. */
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectTeacherRow {
  id: string;
  tenant_id: string;
  subject_id: string;
  teacher_id: string;
  created_at: string;
}

export interface TimetableSlotRow {
  id: string;
  tenant_id: string;
  class_id: string;
  day_of_week: DayOfWeek;
  period_id: string;
  subject_id: string;
  teacher_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

export const SHIFT_LABEL: Record<PeriodShift, string> = {
  SANG: "Sáng",
  CHIEU: "Chiều",
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
};
