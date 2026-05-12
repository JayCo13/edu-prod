import { getTeacherLiveSessions, getTeacherCourses } from "@/app/actions/live-sessions";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import CalendarBoard from "./_components/CalendarBoard";
import CreateSessionModal from "./_components/CreateSessionModal";
import CalendarExportButton from "./_components/CalendarExportButton";

/**
 * Calendar Page (Server Component)
 * =================================
 * Teacher dashboard page for managing live sessions.
 */

export default async function CalendarPage() {
  const [sessionsResult, coursesResult, teachersResult, ctx] =
    await Promise.all([
      getTeacherLiveSessions(),
      getTeacherCourses(),
      getTenantTeachers(),
      getCurrentTenantContext().catch(() => null),
    ]);

  const sessions = sessionsResult.data || [];
  const courses = coursesResult.data || [];
  const teachers = teachersResult.data ?? [];
  const currentTeacherId = ctx?.currentTeacherId ?? null;
  const isAdmin = ctx?.isAdmin ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch dạy trực tuyến</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý các buổi học Live qua Zoom, Google Meet
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <CalendarExportButton sessions={sessions} />
          <CreateSessionModal
            courses={courses}
            teachers={teachers}
            currentTeacherId={currentTeacherId}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* Calendar board (Week / Month / List views) */}
      <CalendarBoard
        sessions={sessions}
        teachers={teachers}
        currentTeacherId={currentTeacherId}
      />
    </div>
  );
}
