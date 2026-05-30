import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PaymentStructure, Session } from "./types";

/**
 * Resolve đơn giá per (teacher × session) qua bảng rate_rules.
 * Snapshot rate object — không lưu rule_id trỏ vào DB live.
 *
 * Matching algorithm (Migration 0037 + plan #1):
 *   1. Lọc rate_rules WHERE teacher_id matches AND date in effective range.
 *   2. Lọc theo scope match: CLASS / COURSE / TEACHER_DEFAULT.
 *   3. Sort theo (specificity, priority DESC, effective_from DESC,
 *      created_at DESC, id ASC) → tie-break đầy đủ deterministic.
 *   4. Pick top. Phải có TEACHER_DEFAULT làm fallback.
 *
 * Co-teaching: session_teachers table. Buổi không có dòng → virtual
 * solo `[{teacher: assigned_teacher_id, share: 100}]`.
 *
 * Cả 2 fetch chỉ chạy lúc service BUILD payroll input — kết quả
 * snapshot ngay, không re-resolve.
 */

/** Cấu trúc rate đã resolve cho 1 (teacher × session). Snapshot vào payroll. */
export interface ResolvedRate {
  /** ID của rule đã match (chỉ dùng cho audit; data lưu ở các field bên dưới). */
  rule_id: string | null;
  rule_scope: "TEACHER_DEFAULT" | "COURSE" | "CLASS";
  scope_id: string | null;
  payment_structure: PaymentStructure;
  hourly_rate: number;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
}

interface RateRuleRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  scope: "TEACHER_DEFAULT" | "COURSE" | "CLASS";
  scope_id: string | null;
  payment_structure: PaymentStructure;
  hourly_rate: number | null;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  created_at: string;
}

interface CoTeachShareRow {
  session_id: string;
  teacher_id: string;
  pay_share_pct: number;
}

const SPECIFICITY_RANK: Record<RateRuleRow["scope"], number> = {
  CLASS: 3,
  COURSE: 2,
  TEACHER_DEFAULT: 1,
};

// ── Build resolver từ bảng + sessions ─────────────────────────────────────

export interface RateResolverInputs {
  /** Tất cả rate_rules active của tenant. */
  rules: RateRuleRow[];
  /** Class → course mapping (để match scope=COURSE qua class_id của session). */
  classCourse: Map<string, string | null>;
  /** Co-teaching shares per session. */
  coTeachShares: Map<string, CoTeachShareRow[]>;
}

/**
 * Match rule tốt nhất cho (teacher, session). Trả null nếu không có rule
 * nào match — caller phải xử lý (default về tenant_teachers.* cũ hoặc
 * raise error).
 */
export function matchRateRule(
  inputs: RateResolverInputs,
  teacherId: string,
  session: Pick<Session, "id" | "class_id" | "date">,
): ResolvedRate | null {
  const courseId = inputs.classCourse.get(session.class_id) ?? null;
  const candidates = inputs.rules.filter((r) => {
    if (r.teacher_id !== teacherId) return false;
    if (r.effective_from > session.date) return false;
    if (r.effective_to !== null && r.effective_to < session.date) return false;
    // Scope match
    if (r.scope === "TEACHER_DEFAULT") return true;
    if (r.scope === "CLASS") return r.scope_id === session.class_id;
    if (r.scope === "COURSE") return courseId !== null && r.scope_id === courseId;
    return false;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // 1. Specificity (cao hơn = thắng)
    const sa = SPECIFICITY_RANK[a.scope];
    const sb = SPECIFICITY_RANK[b.scope];
    if (sa !== sb) return sb - sa;
    // 2. Priority (cao hơn = thắng)
    if (a.priority !== b.priority) return b.priority - a.priority;
    // 3. effective_from gần đây hơn = thắng
    if (a.effective_from !== b.effective_from) {
      return a.effective_from < b.effective_from ? 1 : -1;
    }
    // 4. created_at gần đây hơn = thắng
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? 1 : -1;
    }
    // 5. id ascending (cuối cùng — deterministic guarantee)
    return a.id < b.id ? -1 : 1;
  });

  const top = candidates[0];
  return {
    rule_id: top.id,
    rule_scope: top.scope,
    scope_id: top.scope_id,
    payment_structure: top.payment_structure,
    hourly_rate: top.hourly_rate ?? 0,
    per_session_rate: top.per_session_rate,
    fixed_monthly_amount: top.fixed_monthly_amount,
  };
}

/** Load tất cả rate_rules + class→course map + session_teachers cho 1
 *  tenant trong 1 kỳ lương. Một query gọn cho service. */
export async function loadRateResolverInputs(
  supabase: SupabaseClient,
  tenantId: string,
  sessionIds: string[],
): Promise<RateResolverInputs> {
  const [rulesRes, classesRes, sharesRes] = await Promise.all([
    supabase
      .from("rate_rules")
      .select(
        "id,tenant_id,teacher_id,scope,scope_id,payment_structure,hourly_rate,per_session_rate,fixed_monthly_amount,effective_from,effective_to,priority,created_at",
      )
      .eq("tenant_id", tenantId),
    supabase.from("classes").select("id,course_id").eq("tenant_id", tenantId),
    sessionIds.length > 0
      ? supabase
          .from("session_teachers")
          .select("session_id,teacher_id,pay_share_pct")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [] as CoTeachShareRow[], error: null }),
  ]);

  if (rulesRes.error) throw new Error(rulesRes.error.message);
  if (classesRes.error) throw new Error(classesRes.error.message);
  if (sharesRes.error) throw new Error(sharesRes.error.message);

  const classCourse = new Map<string, string | null>();
  for (const row of (classesRes.data ?? []) as Array<{
    id: string;
    course_id: string | null;
  }>) {
    classCourse.set(row.id, row.course_id);
  }

  const coTeachShares = new Map<string, CoTeachShareRow[]>();
  for (const row of (sharesRes.data ?? []) as CoTeachShareRow[]) {
    const list = coTeachShares.get(row.session_id) ?? [];
    list.push(row);
    coTeachShares.set(row.session_id, list);
  }

  return {
    rules: (rulesRes.data ?? []) as RateRuleRow[],
    classCourse,
    coTeachShares,
  };
}

/** Lấy share của 1 teacher trong 1 session. Mặc định 100% (solo) nếu
 *  session không có dòng nào trong session_teachers. */
export function getCoTeachShare(
  inputs: RateResolverInputs,
  sessionId: string,
  teacherId: string,
  assignedTeacherId: string,
): number {
  const shares = inputs.coTeachShares.get(sessionId);
  if (!shares || shares.length === 0) {
    // Solo — chỉ assigned_teacher_id nhận 100%.
    return assignedTeacherId === teacherId ? 100 : 0;
  }
  const row = shares.find((s) => s.teacher_id === teacherId);
  return row?.pay_share_pct ?? 0;
}
