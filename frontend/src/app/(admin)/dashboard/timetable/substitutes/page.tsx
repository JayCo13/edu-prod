import { redirect } from "next/navigation";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { listSchoolYears } from "@/modules/school-payroll/actions";

import SubstitutesClient from "./_components/SubstitutesClient";

export default async function SubstitutesPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");

  const [yearsRes, teachersRes] = await Promise.all([
    listSchoolYears(),
    getTenantTeachers(),
  ]);

  const years = yearsRes.success ? yearsRes.data : [];
  const teachers = teachersRes.data ?? [];

  // Pick current year (today within start_date..end_date) — if any.
  const today = new Date().toISOString().slice(0, 10);
  const currentYear =
    years.find((y) => today >= y.start_date && today <= y.end_date) ??
    years[0] ??
    null;

  return (
    <div className="space-y-4">
      <header data-tkb-chrome="true">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Thời khoá biểu
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Phân công dạy thay
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Chọn giáo viên nghỉ + ngày → hệ thống gợi ý người thay theo điểm
          (cùng môn, cùng khối, GVCN). Đã ghi nhận sẽ tính vào lương thừa
          giờ cuối năm.
        </p>
      </header>

      {!currentYear ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-900">
          ⚠ Chưa có năm học. Vào{" "}
          <a href="/admin/school-payroll" className="font-semibold underline">
            Lương trường học
          </a>{" "}
          → tab "Năm học" để tạo trước.
        </div>
      ) : (
        <SubstitutesClient
          schoolYearId={currentYear.id}
          schoolYearLabel={currentYear.year_label}
          teachers={teachers}
        />
      )}
    </div>
  );
}
