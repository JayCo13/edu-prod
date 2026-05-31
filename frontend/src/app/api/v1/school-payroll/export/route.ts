import { NextRequest, NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { createClient } from "@/lib/supabase/server";
import { exportSchoolPayrollExcel } from "@/modules/school-payroll/excel";
import { previewSchoolPayrollForAllTeachers } from "@/modules/school-payroll/engine-actions";
import type { SchoolYearPeriodRow } from "@/modules/school-payroll/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  if (!ctx.isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const yearId = req.nextUrl.searchParams.get("year");
  if (!yearId) {
    return new NextResponse("Thiếu year query param", { status: 400 });
  }

  const supabase = await createClient();
  const { data: year } = await supabase
    .from("school_year_periods")
    .select("*")
    .eq("id", yearId)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  if (!year) return new NextResponse("Năm học không tồn tại", { status: 404 });

  const rowsResult = await previewSchoolPayrollForAllTeachers(yearId);
  if (!rowsResult.success) {
    return new NextResponse(rowsResult.error, { status: 500 });
  }

  const buffer = await exportSchoolPayrollExcel({
    schoolYear: year as SchoolYearPeriodRow,
    tenantName: ctx.tenant.name,
    rows: rowsResult.data,
  });

  const filename = `BangLuongThuaGio_${(year as SchoolYearPeriodRow).year_label}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
