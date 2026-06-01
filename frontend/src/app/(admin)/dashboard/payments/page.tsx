import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import PaymentsClient from "./_components/PaymentsClient";

export const metadata = { title: "Học phí — Edura" };

export default async function PaymentsPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");
  if (ctx.tenant.kind !== "CENTER") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Học phí</h1>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi học phí: học sinh sắp tới hạn, quá hạn bao nhiêu ngày.
          Bấm vào dòng để xem chi tiết và đánh dấu đã thu.
        </p>
      </div>
      <PaymentsClient />
    </div>
  );
}
