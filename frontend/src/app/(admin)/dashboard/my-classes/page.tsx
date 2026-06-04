import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import MyClassesClient from "./_components/MyClassesClient";

export const metadata = { title: "Lớp của tôi — Edura" };

export default async function MyClassesPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  // GV (linked teacher slot) hoặc admin (cũng có thể là teacher trong trung
  // tâm của mình) đều thấy được. Chỉ chặn nếu không có currentTeacherId.
  if (!ctx.currentTeacherId) redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lớp của tôi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Các lớp bạn được gán dạy hoặc trợ giảng. Bấm vào lớp để xem buổi tới
          và HS đang theo học.
        </p>
      </div>
      <MyClassesClient />
    </div>
  );
}
