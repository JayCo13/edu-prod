import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SubscriptionPlan, SubscriptionStatus } from "./types";

/**
 * Giới hạn tính năng theo gói (Freemium gating).
 *
 * Áp dụng cho tài khoản loại SCHOOL (xếp thời khoá biểu). CENTER không
 * tính phí theo khối nên không bị giới hạn ở đây.
 *
 *   • EARLY_ACCESS (free): 1 khối — đủ cho user thử thật sản phẩm trên
 *     dữ liệu thật của trường mình (~10-15 lớp / 1 khối).
 *   • GROWTH (paid 500k/tháng): không giới hạn số khối.
 *   • CUSTOM: hợp đồng riêng → không giới hạn.
 *
 * Khi subscription quá hạn (PAST_DUE / SUSPENDED) → coi như rớt về
 * EARLY_ACCESS để khoá tính năng trả phí; user không bị mất dữ liệu,
 * chỉ không tạo được khối mới tới khi gia hạn.
 */

export const PLAN_LIMITS: Record<SubscriptionPlan, { maxGrades: number }> = {
  EARLY_ACCESS: { maxGrades: 1 },
  GROWTH: { maxGrades: Number.POSITIVE_INFINITY },
  CUSTOM: { maxGrades: Number.POSITIVE_INFINITY },
};

export interface PlanLimits {
  plan: SubscriptionPlan;
  maxGrades: number;
  isUnlimited: boolean;
  /** True khi tài khoản đang ở trạng thái có thể dùng tính năng trả phí
   *  (ACTIVE / TRIAL). False khi PAST_DUE / SUSPENDED → ép về free limit. */
  isPaidActive: boolean;
}

export async function getActivePlanLimits(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<PlanLimits> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("tenant_id", tenantId)
    .in("status", ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = (data?.status as SubscriptionStatus | undefined) ?? null;
  const rawPlan = (data?.plan as SubscriptionPlan | undefined) ?? "EARLY_ACCESS";

  // Chỉ ACTIVE / TRIAL được hưởng full quyền của gói trả phí.
  const isPaidActive = status === "ACTIVE" || status === "TRIAL";
  const effectivePlan: SubscriptionPlan = isPaidActive ? rawPlan : "EARLY_ACCESS";

  const max = PLAN_LIMITS[effectivePlan].maxGrades;
  return {
    plan: effectivePlan,
    maxGrades: max,
    isUnlimited: !Number.isFinite(max),
    isPaidActive,
  };
}

export interface GradeQuota {
  usedGrades: number[];
  maxGrades: number;
  isUnlimited: boolean;
  remaining: number;
  plan: SubscriptionPlan;
}

/** Lấy thông tin quota khối hiện tại của tenant — dùng để hiển thị
 *  banner "X/Y khối đã dùng" hoặc kiểm tra trước khi tạo. */
export async function getGradeQuota(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<GradeQuota> {
  const limits = await getActivePlanLimits(supabase, tenantId);
  const { data } = await supabase
    .from("classes")
    .select("grade_level")
    .eq("tenant_id", tenantId)
    .not("grade_level", "is", null);

  const usedGrades = Array.from(
    new Set(
      (data ?? [])
        .map((c) => c.grade_level as number | null)
        .filter((g): g is number => g !== null),
    ),
  ).sort((a, b) => a - b);

  return {
    usedGrades,
    maxGrades: limits.maxGrades,
    isUnlimited: limits.isUnlimited,
    plan: limits.plan,
    remaining: limits.isUnlimited
      ? Number.POSITIVE_INFINITY
      : Math.max(0, limits.maxGrades - usedGrades.length),
  };
}

/** Kiểm tra xem tenant có thể tạo / mở rộng tới khối `targetGrade` không.
 *
 *  Logic:
 *    • Unlimited → luôn cho phép.
 *    • Khối đã có sẵn (vd. user đã có khối 6, tạo thêm lớp khối 6 nữa) → cho.
 *    • Khối mới + chưa đụng max → cho.
 *    • Khối mới + đã max → CHẶN với thông báo rõ ràng để UI hiển thị CTA. */
export async function canUseGrade(
  supabase: SupabaseClient,
  tenantId: string,
  targetGrade: number,
): Promise<
  | { allowed: true; quota: GradeQuota }
  | { allowed: false; quota: GradeQuota; reason: string }
> {
  const quota = await getGradeQuota(supabase, tenantId);

  if (quota.isUnlimited) return { allowed: true, quota };
  if (quota.usedGrades.includes(targetGrade)) return { allowed: true, quota };
  if (quota.usedGrades.length < quota.maxGrades) {
    return { allowed: true, quota };
  }

  return {
    allowed: false,
    quota,
    reason:
      `Gói miễn phí giới hạn ${quota.maxGrades} khối (bạn đã dùng khối ${quota.usedGrades.join(", ")}). ` +
      `Nâng cấp gói Growth (500.000đ/tháng) để xếp thời khoá biểu cho không giới hạn khối.`,
  };
}
