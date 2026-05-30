import { redirect } from "next/navigation";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { listRecurringAdjustments } from "@/modules/payroll/recurring-actions";

import RecurringPanel from "./_components/RecurringPanel";

export default async function RecurringAdjustmentsPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");

  const [rulesResult, teachersResult] = await Promise.all([
    listRecurringAdjustments(),
    getTenantTeachers(),
  ]);
  const rules = rulesResult.success ? rulesResult.data : [];
  const teachers = teachersResult.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bảng lương
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Phụ cấp &amp; khấu trừ định kỳ
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Khai báo các khoản cộng / trừ lặp đi lặp lại hàng tháng (phụ cấp
          GVCN, xăng xe, tạm ứng trả góp…) — hệ thống tự áp vào mỗi kỳ
          lương phù hợp. Bạn không phải gõ lại từng kỳ.
        </p>
      </header>

      <RecurringPanel initialRules={rules} teachers={teachers} />
    </div>
  );
}
