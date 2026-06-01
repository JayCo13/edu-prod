import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import StudentsClient from "./_components/StudentsClient";

export const metadata = { title: "Học sinh — Edura" };

export default async function StudentsPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");
  // CENTER only — SCHOOL không quản lý HS qua Edura.
  if (ctx.tenant.kind !== "CENTER") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Học sinh</h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách học sinh của trung tâm. Mỗi học sinh có mã định danh
            (HS-XXXXXX) để quản lý điểm danh, học phí, lịch sử lớp.
          </p>
        </div>
      </div>

      <StudentsClient />
    </div>
  );
}
