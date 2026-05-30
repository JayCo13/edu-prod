import { redirect } from "next/navigation";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { listRateRules } from "@/modules/payroll/rate-rules-actions";
import { createClient } from "@/lib/supabase/server";

import RatesPanel from "./_components/RatesPanel";

export default async function RateRulesPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const [rulesResult, teachersResult, classesRes, coursesRes] = await Promise.all([
    listRateRules(),
    getTenantTeachers(),
    supabase.from("classes").select("id,name").eq("tenant_id", ctx.tenant.id),
    supabase.from("courses").select("id,title").eq("tenant_id", ctx.tenant.id),
  ]);

  const rules = rulesResult.success ? rulesResult.data : [];
  const teachers = teachersResult.data ?? [];
  const classes = (classesRes.data ?? []) as { id: string; name: string }[];
  const courses = (coursesRes.data ?? []) as { id: string; title: string }[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bảng lương
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Đơn giá theo phạm vi
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Khai báo đơn giá khác nhau cho cùng giáo viên theo từng khoá / lớp.
          Mỗi giáo viên cần ít nhất 1 đơn giá <strong>Mặc định</strong> làm
          fallback. Khi xếp lương, hệ thống tự chọn rule khớp nhất theo thứ tự:
          Lớp ≻ Khoá ≻ Mặc định, sau đó theo priority + ngày hiệu lực.
        </p>
      </header>

      <RatesPanel
        initialRules={rules}
        teachers={teachers}
        classes={classes}
        courses={courses}
      />
    </div>
  );
}
