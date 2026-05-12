import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import TeachersAdminPanel from "./_components/TeachersAdminPanel";

/**
 * Teachers Admin Page
 * ====================
 * Lets the tenant admin manage the roster of teacher slots used by the
 * calendar. Solo teachers see their own row only; centers add staff here.
 *
 * Non-admins are redirected back to /dashboard/calendar.
 */

export default async function TeachersPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard/calendar");

  const result = await getTenantTeachers();
  const teachers = result.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý giáo viên</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tạo các &quot;slot giáo viên&quot; để xếp lịch dạy. Giáo viên có thể
          chưa cần đăng nhập — bạn vẫn xếp được lịch giúp họ trước.
        </p>
      </div>
      <TeachersAdminPanel
        teachers={teachers}
        currentTeacherId={ctx.currentTeacherId}
      />
    </div>
  );
}
