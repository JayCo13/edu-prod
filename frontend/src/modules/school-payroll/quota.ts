import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_REDUCTION_COUNT,
  type EffectiveQuota,
  type QuotaReductionEntry,
  type SchoolYearPeriodRow,
  type TeacherPeriodQuotaRow,
} from "./types";

/**
 * Tính định mức tiết/tuần và định mức tiết/năm hiệu lực cho 1 GV trong
 * 1 năm học.
 *
 * Logic theo TT 05/2025/TT-BGDĐT:
 *   1. Base = teacher_period_quotas.base_periods_per_week
 *           ?? tenants.default_periods_per_week
 *           ?? throw (chưa cấu hình).
 *   2. Lọc reductions:
 *      - Bỏ entry `allowance_received = true` (đã nhận phụ cấp → không
 *        được giảm định mức cùng lúc, theo TT 05 Điều 11).
 *      - Cap số lượng còn lại ≤ MAX_REDUCTION_COUNT (= 2). Entry vượt
 *        cap đẩy vào `ignored_reductions` với lý do "vượt 2 nhiệm vụ".
 *   3. effective_periods_per_week = max(0, base − sum(applied.minus)).
 *   4. effective_periods_per_year = effective_periods_per_week × teaching_weeks.
 *
 * Throws nếu base không xác định được (chưa setup) — caller phải xử lý.
 */
export async function getEffectiveQuota(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    teacherId: string;
    schoolYearId: string;
  },
): Promise<EffectiveQuota> {
  const [quotaRes, tenantRes, yearRes] = await Promise.all([
    supabase
      .from("teacher_period_quotas")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .eq("teacher_id", params.teacherId)
      .eq("school_year_id", params.schoolYearId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("default_periods_per_week")
      .eq("id", params.tenantId)
      .single(),
    supabase
      .from("school_year_periods")
      .select("teaching_weeks")
      .eq("id", params.schoolYearId)
      .single(),
  ]);

  if (yearRes.error || !yearRes.data) {
    throw new Error("Năm học không tồn tại.");
  }
  const teachingWeeks = (yearRes.data as Pick<SchoolYearPeriodRow, "teaching_weeks">)
    .teaching_weeks;

  const quotaRow = quotaRes.data as TeacherPeriodQuotaRow | null;
  const tenantDefault =
    (tenantRes.data as { default_periods_per_week: number | null } | null)
      ?.default_periods_per_week ?? null;

  const base = quotaRow?.base_periods_per_week ?? tenantDefault;
  if (base === null || base === undefined) {
    throw new Error(
      "Chưa cấu hình định mức tiết/tuần cho giáo viên này — cài đặt mặc định trường hoặc override per-teacher.",
    );
  }

  const rawReductions: QuotaReductionEntry[] = (quotaRow?.reductions ??
    []) as QuotaReductionEntry[];

  // Lọc theo allowance_received trước.
  const eligible = rawReductions.filter((r) => !r.allowance_received);
  const ineligibleByAllowance = rawReductions.filter((r) => r.allowance_received);

  // Cap còn lại ≤ MAX_REDUCTION_COUNT.
  const applied = eligible.slice(0, MAX_REDUCTION_COUNT);
  const overCap = eligible.slice(MAX_REDUCTION_COUNT);

  const ignored: EffectiveQuota["ignored_reductions"] = [
    ...ineligibleByAllowance.map((entry) => ({
      entry,
      reason: "Đã nhận phụ cấp/thù lao — không giảm định mức (TT 05 Điều 11)",
    })),
    ...overCap.map((entry) => ({
      entry,
      reason: `Vượt quá ${MAX_REDUCTION_COUNT} nhiệm vụ kiêm nhiệm — TT 05`,
    })),
  ];

  const totalMinus = applied.reduce((sum, r) => sum + (r.minus || 0), 0);
  const effectivePerWeek = Math.max(0, base - totalMinus);

  return {
    base_periods_per_week: base,
    applied_reductions: applied,
    ignored_reductions: ignored,
    effective_periods_per_week: effectivePerWeek,
    effective_periods_per_year: effectivePerWeek * teachingWeeks,
  };
}
