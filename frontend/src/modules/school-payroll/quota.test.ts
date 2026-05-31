import { describe, expect, it } from "vitest";

import { MAX_REDUCTION_COUNT } from "./types";
import type { QuotaReductionEntry } from "./types";

/**
 * Unit tests cho LOGIC của getEffectiveQuota — tách phần thuần (filter +
 * cap + sum) ra khỏi I/O Supabase. Quota.ts hiện gọi DB trực tiếp; ở
 * đây mình replicate pure logic để cover các edge case TT 05/2025.
 */

function applyReductionLogic(
  base: number,
  reductions: QuotaReductionEntry[],
): {
  applied: QuotaReductionEntry[];
  ignored: Array<{ entry: QuotaReductionEntry; reason: string }>;
  effective_per_week: number;
} {
  const eligible = reductions.filter((r) => !r.allowance_received);
  const ineligibleByAllowance = reductions.filter((r) => r.allowance_received);

  const applied = eligible.slice(0, MAX_REDUCTION_COUNT);
  const overCap = eligible.slice(MAX_REDUCTION_COUNT);

  const ignored: Array<{ entry: QuotaReductionEntry; reason: string }> = [
    ...ineligibleByAllowance.map((entry) => ({ entry, reason: "allowance" })),
    ...overCap.map((entry) => ({ entry, reason: "over_cap" })),
  ];

  const totalMinus = applied.reduce((sum, r) => sum + r.minus, 0);
  return {
    applied,
    ignored,
    effective_per_week: Math.max(0, base - totalMinus),
  };
}

describe("getEffectiveQuota logic — TT 05/2025", () => {
  it("THCS GV thuần (19 tiết/tuần, không kiêm nhiệm) → 19", () => {
    const r = applyReductionLogic(19, []);
    expect(r.effective_per_week).toBe(19);
    expect(r.applied).toHaveLength(0);
  });

  it("THCS + GVCN (−4) → 15", () => {
    const r = applyReductionLogic(19, [
      { type: "GVCN", minus: 4, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(15);
    expect(r.applied).toHaveLength(1);
  });

  it("THCS + GVCN + Tổ trưởng → 19 − 4 − 3 = 12 (2 kiêm nhiệm, dưới cap)", () => {
    const r = applyReductionLogic(19, [
      { type: "GVCN", minus: 4, allowance_received: false },
      { type: "TO_TRUONG", minus: 3, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(12);
    expect(r.applied).toHaveLength(2);
    expect(r.ignored).toHaveLength(0);
  });

  it("THCS + 3 kiêm nhiệm → chỉ áp 2 đầu, cái 3 bị ignore (TT 05 max 2)", () => {
    const r = applyReductionLogic(19, [
      { type: "GVCN", minus: 4, allowance_received: false },
      { type: "TO_TRUONG", minus: 3, allowance_received: false },
      { type: "TO_PHO_HS", minus: 1, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(12); // 19 - 4 - 3, không trừ −1
    expect(r.applied).toHaveLength(2);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0].reason).toBe("over_cap");
  });

  it("GVCN đã nhận phụ cấp → không trừ định mức (TT 05 Điều 11)", () => {
    const r = applyReductionLogic(19, [
      { type: "GVCN", minus: 4, allowance_received: true },
    ]);
    expect(r.effective_per_week).toBe(19);
    expect(r.applied).toHaveLength(0);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0].reason).toBe("allowance");
  });

  it("Mix: GVCN có phụ cấp + Tổ trưởng không phụ cấp → chỉ áp tổ trưởng", () => {
    const r = applyReductionLogic(19, [
      { type: "GVCN", minus: 4, allowance_received: true },
      { type: "TO_TRUONG", minus: 3, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(16); // 19 - 3
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0].type).toBe("TO_TRUONG");
  });

  it("Sum minus > base → effective clamp về 0 (không âm)", () => {
    const r = applyReductionLogic(10, [
      { type: "GVCN", minus: 8, allowance_received: false },
      { type: "TO_TRUONG", minus: 8, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(0);
  });

  it("Tiểu học (23 tiết/tuần) + GVCN −4 → 19", () => {
    const r = applyReductionLogic(23, [
      { type: "GVCN", minus: 4, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(19);
  });

  it("THPT DTNT (15 tiết/tuần) + Tổ trưởng + Tổ phó → 15 − 3 − 1 = 11", () => {
    const r = applyReductionLogic(15, [
      { type: "TO_TRUONG", minus: 3, allowance_received: false },
      { type: "TO_PHO", minus: 1, allowance_received: false },
    ]);
    expect(r.effective_per_week).toBe(11);
  });
});
