import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { listSchoolYears } from "@/modules/school-payroll/actions";
import { createClient } from "@/lib/supabase/server";

import SchoolPayrollDashboard from "./_components/SchoolPayrollDashboard";

interface Props {
  searchParams: Promise<{ year?: string; tab?: string }>;
}

export default async function SchoolPayrollPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");

  const [yearsResult, teachersResult] = await Promise.all([
    listSchoolYears(),
    getTenantTeachers(),
  ]);
  const years = yearsResult.success ? yearsResult.data : [];
  const teachers = teachersResult.data ?? [];

  const supabase = await createClient();
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("default_periods_per_week")
    .eq("id", ctx.tenant.id)
    .single();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Trường học
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Lương thừa giờ &amp; dạy thay
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Quản lý định mức, đơn giá, dạy thay và tính lương thừa giờ theo
            năm học (TT 05/2025 + TT 21/2025).
          </p>
        </div>
        <Link
          href="/dashboard/timetable/substitutes"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Phân công dạy thay →
        </Link>
      </header>

      <SchoolPayrollDashboard
        initialYears={years}
        teachers={teachers}
        defaultPeriodsPerWeek={
          (tenantData as { default_periods_per_week: number | null } | null)
            ?.default_periods_per_week ?? null
        }
        initialSelectedYearId={sp.year ?? years[0]?.id ?? null}
        initialTab={(sp.tab as "years" | "config" | "preview") ?? "years"}
      />
    </div>
  );
}
