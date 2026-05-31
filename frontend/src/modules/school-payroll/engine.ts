import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEffectiveQuota } from "./quota";
import { computePeriodRateSegments } from "./salary-rate";
import {
  OVERTIME_CAP_PER_YEAR,
  OVERTIME_MULTIPLIER,
  type EffectiveQuota,
  type PeriodRateForYear,
  type SchoolYearPeriodRow,
} from "./types";

/**
 * Engine tính lương thừa giờ + dạy thay cho 1 GV trong 1 năm học.
 *
 * MVP simplification (chấp nhận được, hợp lý với cách trường thực sự
 * tính):
 *   - Tiết planned/năm = số slot trong timetable_slots × teaching_weeks
 *   - Tiết bị thay đi (substituted away) = count substitutions where
 *     original_teacher_id = T
 *   - Tiết thay vào (substituted into) = count substitutions where
 *     substitute_teacher_id = T AND pay_substitute = true
 *   - Tổng thực dạy = planned − bị_thay_đi + thay_vào
 *
 * Đây là approximation: giả định GV dạy đúng TKB mỗi tuần trừ những
 * trường hợp có ghi nhận dạy thay. Để chính xác hơn cần lesson
 * attendance tracking — chưa có trong MVP.
 *
 * Cap 200 tiết/năm + đánh dấu phần bị cắt (TT 21):
 *   overtime_uncapped = max(0, total_actual − quota_year)
 *   overtime_paid     = min(overtime_uncapped, 200)
 *   overtime_uncovered = max(0, overtime_uncapped − 200)
 *
 * Đơn giá: weighted_avg theo segment lương trong năm (handle case lương
 * đổi giữa năm).
 *
 * Cấn tạm ứng:
 *   net = total_overtime_pay − sum(advances)
 *   Có thể âm (đã ứng vượt) — engine RA số âm, không clamp 0.
 */

export interface SchoolPayrollResult {
  teacher_id: string;
  school_year_id: string;

  // Định mức
  quota: EffectiveQuota;

  // Tiết
  planned_periods_per_year: number; // số slot × teaching_weeks
  substituted_away_count: number;
  substituted_into_count: number;
  total_actual_periods: number;

  // Thừa giờ
  overtime_uncapped: number;
  overtime_paid: number; // capped tại 200
  overtime_uncovered: number; // phần bị cắt

  // Đơn giá
  rate: PeriodRateForYear;

  // Tiền
  overtime_total_pay_vnd: number; // overtime_paid × weighted_avg × 1.5
  total_advances_vnd: number;
  net_settlement_vnd: number; // overtime_total_pay - total_advances — có thể âm

  // Audit
  audit: SchoolPayrollAudit[];
}

export interface SchoolPayrollAudit {
  kind:
    | "QUOTA"
    | "RATE_SEGMENT"
    | "PLANNED_COUNT"
    | "SUBSTITUTION_OUT"
    | "SUBSTITUTION_IN"
    | "OVERTIME_CAP"
    | "ADVANCE_RECONCILE"
    | "WARNING";
  message: string;
  amount_vnd?: number;
}

export async function calculateSchoolYearPayrollForTeacher(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    teacherId: string;
    schoolYearId: string;
  },
): Promise<SchoolPayrollResult> {
  const audit: SchoolPayrollAudit[] = [];

  // 1. Năm học
  const { data: year } = await supabase
    .from("school_year_periods")
    .select("*")
    .eq("id", params.schoolYearId)
    .single();
  if (!year) throw new Error("Năm học không tồn tại.");
  const yearRow = year as SchoolYearPeriodRow;

  // 2. Quota
  const quota = await getEffectiveQuota(supabase, params);
  audit.push({
    kind: "QUOTA",
    message: `Định mức ${quota.effective_periods_per_week} tiết/tuần × ${yearRow.teaching_weeks} tuần = ${quota.effective_periods_per_year} tiết/năm`,
  });
  for (const ig of quota.ignored_reductions) {
    audit.push({
      kind: "WARNING",
      message: `Bỏ qua giảm trừ ${ig.entry.type}: ${ig.reason}`,
    });
  }

  // 3. Rate segments
  const rate = await computePeriodRateSegments(supabase, params);
  for (const seg of rate.segments) {
    audit.push({
      kind: "RATE_SEGMENT",
      message: `${seg.effective_from} → ${seg.effective_to}: ${formatVnd(seg.rate_per_period_vnd)}/tiết (${seg.mode})`,
      amount_vnd: seg.rate_per_period_vnd,
    });
  }

  // 4. Tiết planned theo TKB
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("teacher_id", params.teacherId);

  const slotsPerWeek = slots?.length ?? 0;
  const planned = slotsPerWeek * yearRow.teaching_weeks;
  audit.push({
    kind: "PLANNED_COUNT",
    message: `TKB: ${slotsPerWeek} tiết/tuần × ${yearRow.teaching_weeks} tuần = ${planned} tiết/năm`,
  });

  // 5. Dạy thay
  const { data: subAway } = await supabase
    .from("substitutions")
    .select("id, date")
    .eq("tenant_id", params.tenantId)
    .eq("school_year_id", params.schoolYearId)
    .eq("original_teacher_id", params.teacherId);

  const { data: subInto } = await supabase
    .from("substitutions")
    .select("id, date")
    .eq("tenant_id", params.tenantId)
    .eq("school_year_id", params.schoolYearId)
    .eq("substitute_teacher_id", params.teacherId)
    .eq("pay_substitute", true);

  const awayCount = subAway?.length ?? 0;
  const intoCount = subInto?.length ?? 0;
  audit.push({
    kind: "SUBSTITUTION_OUT",
    message: `Bị thay đi: ${awayCount} tiết (GV khác dạy thay)`,
  });
  audit.push({
    kind: "SUBSTITUTION_IN",
    message: `Dạy thay nhận: ${intoCount} tiết`,
  });

  const totalActual = planned - awayCount + intoCount;

  // 6. Thừa giờ + cap
  const uncapped = Math.max(0, totalActual - quota.effective_periods_per_year);
  const paid = Math.min(uncapped, OVERTIME_CAP_PER_YEAR);
  const uncovered = Math.max(0, uncapped - OVERTIME_CAP_PER_YEAR);

  if (uncovered > 0) {
    audit.push({
      kind: "OVERTIME_CAP",
      message: `Vượt trần ${OVERTIME_CAP_PER_YEAR} tiết/năm — ${uncovered} tiết KHÔNG được trả thừa giờ (TT 21/2025)`,
    });
  }

  const overtimePay = Math.floor(
    paid * rate.weighted_avg_rate_per_period_vnd * OVERTIME_MULTIPLIER,
  );

  // 7. Cấn tạm ứng
  const { data: advances } = await supabase
    .from("teacher_overtime_advances")
    .select("advance_amount_vnd")
    .eq("tenant_id", params.tenantId)
    .eq("teacher_id", params.teacherId)
    .eq("school_year_id", params.schoolYearId);

  const totalAdvances = (advances ?? []).reduce(
    (s, a) => s + ((a.advance_amount_vnd as number) || 0),
    0,
  );

  const net = overtimePay - totalAdvances;
  audit.push({
    kind: "ADVANCE_RECONCILE",
    message:
      net < 0
        ? `Đã tạm ứng ${formatVnd(totalAdvances)}, quyết toán chỉ ${formatVnd(overtimePay)} → THU HỒI ${formatVnd(-net)}`
        : `Đã tạm ứng ${formatVnd(totalAdvances)} → còn chi ${formatVnd(net)}`,
    amount_vnd: net,
  });

  return {
    teacher_id: params.teacherId,
    school_year_id: params.schoolYearId,
    quota,
    planned_periods_per_year: planned,
    substituted_away_count: awayCount,
    substituted_into_count: intoCount,
    total_actual_periods: totalActual,
    overtime_uncapped: uncapped,
    overtime_paid: paid,
    overtime_uncovered: uncovered,
    rate,
    overtime_total_pay_vnd: overtimePay,
    total_advances_vnd: totalAdvances,
    net_settlement_vnd: net,
    audit,
  };
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
