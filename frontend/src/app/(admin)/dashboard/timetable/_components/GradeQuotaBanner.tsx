"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { getCurrentGradeQuota } from "@/modules/timetable/actions";
import type { GradeQuota } from "@/modules/billing/limits";

/**
 * Banner ở đầu mục Thời khoá biểu — hiển thị quota khối + CTA nâng cấp
 * khi tài khoản còn ở gói miễn phí (EARLY_ACCESS). Ẩn hoàn toàn nếu
 * gói trả phí hoặc gọi quota lỗi (im lặng — không phá UI).
 */
export default function GradeQuotaBanner() {
  const [quota, setQuota] = useState<GradeQuota | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentGradeQuota().then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setQuota(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quota || quota.isUnlimited) return null;

  const used = quota.usedGrades.length;
  const max = quota.maxGrades;
  const atLimit = used >= max;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        atLimit
          ? "border-amber-200 bg-amber-50/70"
          : "border-indigo-200 bg-indigo-50/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              atLimit ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {atLimit
                ? `Đã dùng hết quota khối (${used}/${max})`
                : `Gói miễn phí — đã dùng ${used}/${max} khối`}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {atLimit
                ? `Bạn đã xếp khối ${quota.usedGrades.join(", ")}. Nâng cấp Growth (500.000đ/tháng) để thêm khối không giới hạn.`
                : `Đủ thử nghiệm trên 1 khối thật. Khi cần xếp thêm khối, nâng cấp Growth (500.000đ/tháng).`}
            </p>
          </div>
        </div>
        <Link
          href="/admin/billing"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Nâng cấp Growth
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
