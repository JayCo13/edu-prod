import { redirect } from "next/navigation";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { createClient } from "@/lib/supabase/server";
import { formatDateVN } from "@/modules/payroll/format";

import ShadowDiffsTable from "./_components/ShadowDiffsTable";

interface Props {
  params: Promise<{ periodId: string }>;
}

export default async function ShadowDiffPage({ params }: Props) {
  const { periodId } = await params;

  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");

  const supabase = await createClient();

  // Fetch period info + diffs + teacher names.
  const [periodRes, diffsRes, teachersRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("id,period_start,period_end,status")
      .eq("id", periodId)
      .eq("center_id", ctx.tenant.id)
      .maybeSingle(),
    supabase
      .from("payroll_engine_shadow_diffs")
      .select(
        "id,teacher_id,old_final_amount,new_final_amount,diff_amount,diff_summary,old_breakdown,new_breakdown",
      )
      .eq("payroll_period_id", periodId)
      .eq("tenant_id", ctx.tenant.id)
      .order("diff_amount", { ascending: false }),
    supabase
      .from("tenant_teachers")
      .select("id, display_name")
      .eq("tenant_id", ctx.tenant.id),
  ]);

  if (!periodRes.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-slate-600">Không tìm thấy kỳ lương.</p>
      </div>
    );
  }

  const teacherMap = new Map<string, string>();
  for (const t of (teachersRes.data ?? []) as { id: string; display_name: string }[]) {
    teacherMap.set(t.id, t.display_name);
  }

  const diffs = diffsRes.data ?? [];
  const nonZeroCount = diffs.filter((d) => d.diff_amount !== 0).length;
  const totalCount = diffs.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bảng lương · Shadow diff
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          So sánh engine — kỳ {formatDateVN(periodRes.data.period_start)} → {formatDateVN(periodRes.data.period_end)}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Trang này hiển thị chênh lệch giữa engine cũ (đang dùng cho bảng
          lương chính) và engine mới (rate_rules + co-teaching). Số tiền chi
          cho giáo viên KHÔNG đổi — đây chỉ là dữ liệu so sánh để quyết định
          khi nào chuyển sang engine mới ở Cài đặt.
        </p>
      </header>

      {totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Chưa có dữ liệu so sánh cho kỳ này.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kỳ này được tạo khi chế độ engine = OLD, hoặc kỳ tạo trước khi
            shadow-run được bật. Tạo kỳ mới ở chế độ SHADOW để xem so sánh.
          </p>
        </div>
      ) : (
        <>
          {/* Banner tổng quan */}
          <div
            className={`rounded-2xl border px-5 py-4 ${
              nonZeroCount === 0
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/60"
            }`}
          >
            <p className="text-sm font-bold text-slate-900">
              {nonZeroCount === 0
                ? `✓ Engine cũ và mới ra cùng kết quả cho ${totalCount} giáo viên.`
                : `⚠ ${nonZeroCount}/${totalCount} dòng có chênh lệch.`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {nonZeroCount === 0
                ? "Có thể an tâm chuyển sang chế độ NEW ở Cài đặt khi đã có ít nhất 1-2 kỳ shadow xác nhận."
                : "Review từng dòng bên dưới. Lý do dự đoán giúp xác định có phải do override rule hay co-teaching."}
            </p>
          </div>

          <ShadowDiffsTable diffs={diffs} teacherMap={teacherMap} />
        </>
      )}
    </div>
  );
}
