import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
      <Link
        href="/admin/payroll"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại Bảng lương
      </Link>
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bảng lương
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Đơn giá giáo viên
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Đặt mức tiền cụ thể cho từng giáo viên. Có thể đặt một mức chung
          (áp cho tất cả lớp) và thêm mức riêng cho từng lớp / khoá nếu
          khác nhau. Mỗi giáo viên cần ít nhất một mức chung. Khi tính lương,
          nếu lớp có mức riêng thì lấy mức riêng, không có thì lấy mức chung.
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
