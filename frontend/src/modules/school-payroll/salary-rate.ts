import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEffectiveQuota } from "./quota";
import type {
  PeriodRateForYear,
  PeriodRateSegment,
  SchoolYearPeriodRow,
  TeacherSalaryBasisRow,
} from "./types";

/**
 * Compute đơn giá tiết theo từng giai đoạn (time-segment) trong 1 năm
 * học.
 *
 * Lý do phải time-segment-aware:
 *   - Lương cơ sở nhà nước có thể đổi giữa năm (vd. nghị định nâng từ
 *     1.8M lên 2.34M).
 *   - GV nâng bậc lương (3 năm/lần) hoặc thăng hạng → hệ số đổi.
 *
 * Khi 1 năm học có nhiều dòng teacher_salary_basis với effective_from/to
 * khác nhau → engine compute đơn giá cho TỪNG segment, không phẳng cả
 * năm. Output thêm `weighted_avg` để display tổng quan.
 *
 * Công thức theo TT 21/2025:
 *
 *   Mode A (compute, trường công):
 *     monthly_salary =
 *       salary_coefficient × base_salary
 *       + position_allowance
 *       + other_allowances
 *       + bao_luu_coefficient × base_salary
 *     annual_salary = monthly_salary × 12
 *     rate_per_period = annual_salary / effective_periods_per_year
 *
 *   Mode B (flat, trường tư):
 *     rate_per_period = flat_rate_per_period_vnd  (input trực tiếp)
 *
 * Throws nếu:
 *   - Không có dòng basis nào trong năm học.
 *   - Mode A nhưng định mức năm = 0 (chia cho 0) → throw rõ ràng.
 */
export async function computePeriodRateSegments(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    teacherId: string;
    schoolYearId: string;
  },
): Promise<PeriodRateForYear> {
  const [basisRes, yearRes] = await Promise.all([
    supabase
      .from("teacher_salary_basis")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .eq("teacher_id", params.teacherId)
      .eq("school_year_id", params.schoolYearId)
      .order("effective_from", { ascending: true }),
    supabase
      .from("school_year_periods")
      .select("*")
      .eq("id", params.schoolYearId)
      .single(),
  ]);

  if (yearRes.error || !yearRes.data) {
    throw new Error("Năm học không tồn tại.");
  }
  const year = yearRes.data as SchoolYearPeriodRow;
  const rows = (basisRes.data ?? []) as TeacherSalaryBasisRow[];

  if (rows.length === 0) {
    throw new Error(
      "Chưa cấu hình cơ sở tính lương cho giáo viên trong năm học này.",
    );
  }

  // Quota cần để compute mode A. Lấy 1 lần — định mức năm cố định cho
  // năm học (giảm trừ kiêm nhiệm không đổi giữa năm).
  const quota = await getEffectiveQuota(supabase, params);
  if (quota.effective_periods_per_year <= 0) {
    throw new Error(
      "Định mức tiết/năm = 0 — không thể tính đơn giá. Kiểm tra cấu hình giảm trừ kiêm nhiệm.",
    );
  }

  // Clip mỗi segment vào khung [year.start_date, year.end_date].
  const segments: PeriodRateSegment[] = [];
  for (const row of rows) {
    const from = maxDate(row.effective_from, year.start_date);
    const to = minDate(row.effective_to ?? year.end_date, year.end_date);
    if (from > to) continue; // segment ngoài năm học → bỏ

    if (row.flat_rate_per_period_vnd !== null) {
      // Mode B
      segments.push({
        effective_from: from,
        effective_to: to,
        rate_per_period_vnd: row.flat_rate_per_period_vnd,
        mode: "FLAT",
      });
    } else if (
      row.salary_coefficient !== null &&
      row.base_salary_vnd !== null
    ) {
      // Mode A — compute từ hệ số
      const monthlySalary =
        row.salary_coefficient * row.base_salary_vnd +
        (row.position_allowance_vnd ?? 0) +
        (row.other_allowances_vnd ?? 0) +
        (row.bao_luu_coefficient ?? 0) * row.base_salary_vnd;
      const annualSalary = monthlySalary * 12;
      const rate = Math.floor(annualSalary / quota.effective_periods_per_year);

      segments.push({
        effective_from: from,
        effective_to: to,
        rate_per_period_vnd: rate,
        mode: "COMPUTED",
        basis_snapshot: {
          salary_coefficient: row.salary_coefficient,
          base_salary_vnd: row.base_salary_vnd,
          position_allowance_vnd: row.position_allowance_vnd ?? 0,
          other_allowances_vnd: row.other_allowances_vnd ?? 0,
          bao_luu_coefficient: row.bao_luu_coefficient ?? 0,
          annual_quota_periods: quota.effective_periods_per_year,
        },
      });
    }
    // Else: row không hợp lệ (vi phạm CHECK constraint, nhưng defensive)
  }

  if (segments.length === 0) {
    throw new Error(
      "Không có giai đoạn lương nào trong năm học. Kiểm tra effective_from/to.",
    );
  }

  // Weighted avg theo số ngày của mỗi segment.
  let totalDays = 0;
  let weighted = 0;
  for (const seg of segments) {
    const days = daysBetween(seg.effective_from, seg.effective_to);
    totalDays += days;
    weighted += days * seg.rate_per_period_vnd;
  }
  const weightedAvg =
    totalDays > 0 ? Math.floor(weighted / totalDays) : segments[0].rate_per_period_vnd;

  return {
    segments,
    weighted_avg_rate_per_period_vnd: weightedAvg,
  };
}

// ── Date helpers ────────────────────────────────────────────────────────

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}
function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
/** Số ngày inclusive từ `from` đến `to`. Cả 2 đầu kể vào. */
function daysBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((t - f) / 86_400_000) + 1;
}
