import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { listAdminCourses } from "@/app/actions/admin-courses";
import CoursesAdminPanel from "./_components/CoursesAdminPanel";

/**
 * Khóa học — admin CRUD.
 *
 * Center admins create entries that live sessions can attach to (the
 * "Khóa học" dropdown on the calendar create modal). Title + description
 * only; the legacy LMS fields keep their defaults.
 *
 * Non-admin teachers are bounced to /dashboard/calendar — they don't need
 * to (and can't, per RLS) manage courses.
 */
export default async function CoursesAdminPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard/calendar");

  const result = await listAdminCourses();
  const courses = result.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Khóa học</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý danh mục khóa học. Buổi học trên lịch có thể gán vào khóa
          để dễ phân loại.
        </p>
      </div>

      <CoursesAdminPanel initialCourses={courses} />
    </div>
  );
}
