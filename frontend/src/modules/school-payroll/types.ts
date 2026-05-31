// ── Types cho school-payroll module ────────────────────────────────────
//
// Module ĐỨNG RIÊNG khỏi modules/payroll (engine trung tâm). Chia sẻ duy
// nhất: payroll_periods workflow, audit_logs, Excel framework.

export type SubstitutionType = "SUBSTITUTE";

export type SubstitutionReason =
  | "ÔM"
  | "PHÉP"
  | "KHÔNG_PHÉP"
  | "CÔNG_TÁC"
  | "BỒI_DƯỠNG"
  | "KHÁC";

export type QuotaReductionType =
  | "GVCN"
  | "TO_TRUONG"
  | "TO_PHO"
  | "TO_TRUONG_HS"
  | "TO_PHO_HS"
  | "KHAC";

// Theo TT 05/2025/TT-BGDĐT.
export const REDUCTION_DEFAULTS: Record<
  QuotaReductionType,
  { default_minus: number; label: string }
> = {
  GVCN: { default_minus: 4, label: "Giáo viên chủ nhiệm lớp" },
  TO_TRUONG: { default_minus: 3, label: "Tổ trưởng chuyên môn" },
  TO_PHO: { default_minus: 1, label: "Tổ phó chuyên môn" },
  TO_TRUONG_HS: {
    default_minus: 3,
    label: "Tổ trưởng quản lý HS (nội trú/bán trú)",
  },
  TO_PHO_HS: {
    default_minus: 1,
    label: "Tổ phó quản lý HS (nội trú/bán trú)",
  },
  KHAC: { default_minus: 0, label: "Giảm trừ khác" },
};

// TT 05: tối đa 2 nhiệm vụ kiêm nhiệm được giảm định mức.
export const MAX_REDUCTION_COUNT = 2;

// TT 21: trần thừa giờ năm học.
export const OVERTIME_CAP_PER_YEAR = 200;

// TT 21: hệ số dạy thêm giờ.
export const OVERTIME_MULTIPLIER = 1.5;

// ── Row types ──────────────────────────────────────────────────────────

export interface SchoolYearPeriodRow {
  id: string;
  tenant_id: string;
  year_label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  teaching_weeks: number;
  holidays_jsonb: unknown[];
  created_at: string;
  updated_at: string;
}

export interface QuotaReductionEntry {
  type: QuotaReductionType;
  minus: number;
  /** Đã nhận phụ cấp hoặc thù lao tương ứng — theo TT 05 thì KHÔNG
   *  giảm định mức trong case này (vẫn ghi nhận vai trò, không trừ tiết). */
  allowance_received: boolean;
  note?: string;
}

export interface TeacherPeriodQuotaRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  school_year_id: string;
  base_periods_per_week: number | null; // null = lấy default tenant
  reductions: QuotaReductionEntry[];
  created_at: string;
  updated_at: string;
}

export interface TeacherSalaryBasisRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  school_year_id: string;
  // Mode A
  salary_coefficient: number | null;
  base_salary_vnd: number | null;
  position_allowance_vnd: number;
  other_allowances_vnd: number;
  bao_luu_coefficient: number;
  // Mode B
  flat_rate_per_period_vnd: number | null;
  // Time-series
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubstitutionRow {
  id: string;
  tenant_id: string;
  school_year_id: string;
  type: SubstitutionType;
  timetable_slot_id: string | null;
  session_id: string | null;
  date: string;
  period_index: number;
  shift: string | null;
  original_teacher_id: string;
  substitute_teacher_id: string;
  reason: SubstitutionReason;
  reason_note: string | null;
  pay_substitute: boolean;
  deduct_original_flag: boolean;
  deduct_original_note: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherOvertimeAdvanceRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  school_year_id: string;
  payroll_period_id: string;
  advance_amount_vnd: number;
  cumulative_periods_at_advance: number;
  cumulative_overtime_amount_at_advance: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Computed types (engine output) ─────────────────────────────────────

export interface EffectiveQuota {
  /** Tiết/tuần định mức cơ sở (base). */
  base_periods_per_week: number;
  /** Các reduction đã được áp (đã loại các entry allowance_received=true,
   *  và đã cap số lượng ≤ MAX_REDUCTION_COUNT). */
  applied_reductions: QuotaReductionEntry[];
  /** Các reduction bị bỏ qua + lý do (để audit). */
  ignored_reductions: Array<{ entry: QuotaReductionEntry; reason: string }>;
  /** Định mức tiết/tuần thực tế = base - sum(applied minus). Không âm. */
  effective_periods_per_week: number;
  /** Định mức tiết/năm = effective_periods_per_week × teaching_weeks. */
  effective_periods_per_year: number;
}

/** 1 segment đơn giá tiết theo time-slice trong năm học. */
export interface PeriodRateSegment {
  effective_from: string;
  effective_to: string; // capped tại end_date của school year
  rate_per_period_vnd: number;
  /** Mode dùng cho segment này — để audit. */
  mode: "COMPUTED" | "FLAT";
  /** Snapshot input cho audit (nếu COMPUTED). */
  basis_snapshot?: {
    salary_coefficient: number;
    base_salary_vnd: number;
    position_allowance_vnd: number;
    other_allowances_vnd: number;
    bao_luu_coefficient: number;
    annual_quota_periods: number;
  };
}

export interface PeriodRateForYear {
  segments: PeriodRateSegment[];
  /** Trung bình trọng số theo số ngày của mỗi segment. */
  weighted_avg_rate_per_period_vnd: number;
}
