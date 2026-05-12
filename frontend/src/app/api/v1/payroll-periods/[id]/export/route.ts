/**
 * GET /api/v1/payroll-periods/:id/export
 *
 * Streams the Vietnamese-format Excel for the requested period.
 * Permission: CENTER_ADMIN (RLS enforces; service double-checks).
 * Spec: PRD §5.8 — "Export to Excel (with breakdown)".
 *
 * Filename: bang-luong-<YYYY-MM>.xlsx  (avoids non-ASCII headers).
 */

import { NextResponse } from "next/server";
import { getPayrollPeriod } from "@/modules/payroll/service";
import { buildPayrollBuffer } from "@/modules/payroll/excel";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";
import { getCenterById } from "@/modules/centers/service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const periodResult = await getPayrollPeriod(id);
  if (!periodResult.success) {
    const status = periodResult.error.includes("đăng nhập")
      ? 401
      : periodResult.error.includes("quyền")
        ? 403
        : periodResult.error.includes("Không tìm thấy")
          ? 404
          : 500;
    return NextResponse.json({ error: periodResult.error }, { status });
  }
  const period = periodResult.data;

  // We need the center identity for the Excel header. Resolve via the
  // current request's center (RLS guarantees it's the caller's).
  const resolved = await resolveCenterId({ centerId: period.center_id });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 403 });
  }
  const centerResult = await getCenterById(resolved.centerId);
  if (!centerResult.success) {
    return NextResponse.json({ error: centerResult.error }, { status: 500 });
  }
  const center = centerResult.data;

  const buf = await buildPayrollBuffer({
    period,
    items: period.items,
    center: { name: center.name, address: center.address },
  });
  // Wrap in Blob so NextResponse accepts it as BodyInit across Node + Edge.
  const blob = new Blob([new Uint8Array(buf)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const monthTag = period.period_start.slice(0, 7); // YYYY-MM
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bang-luong-${monthTag}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
