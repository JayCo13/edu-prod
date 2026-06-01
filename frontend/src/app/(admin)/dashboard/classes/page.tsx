import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import ClassesClient from "./_components/ClassesClient";

export const metadata = { title: "Lớp học — Edura" };

export default async function ClassesPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");
  if (ctx.tenant.kind !== "CENTER") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lớp học</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tạo và quản lý lớp học của trung tâm. Học sinh được đăng ký vào lớp
          để theo dõi điểm danh, học phí và lịch sử lớp.
        </p>
      </div>
      <ClassesClient />
    </div>
  );
}
