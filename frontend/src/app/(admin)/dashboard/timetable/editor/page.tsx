import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  listClasses,
  listPeriods,
  listSubjectTeachers,
  listSubjects,
} from "@/modules/timetable/actions";
import { listSlotsForTenant } from "@/modules/timetable/slot-actions";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import EditorClient from "./_components/EditorClient";

export default async function TimetableEditorPage() {
  const ctx = await getCurrentTenantContext().catch(() => null);
  const [classes, subjects, periods, slots, teachers, subjectTeachers] =
    await Promise.all([
      listClasses(),
      listSubjects(),
      listPeriods(),
      listSlotsForTenant(),
      getTenantTeachers(),
      listSubjectTeachers(),
    ]);

  // Bail out gently if any of the prerequisites are missing — the editor
  // can't do anything useful without classes / subjects / periods.
  const missing: string[] = [];
  if ((classes.data?.length ?? 0) === 0) missing.push("Lớp");
  if ((subjects.data?.length ?? 0) === 0) missing.push("Môn học");
  if ((periods.data?.length ?? 0) === 0) missing.push("Khung tiết");
  if (missing.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold text-amber-900">
          Cần thiết lập trước
        </h2>
        <p className="max-w-md text-sm text-amber-800/80">
          Để bắt đầu xếp thời khoá biểu, bạn cần có{" "}
          <strong>{missing.join(", ")}</strong>. Quay lại các tab tương ứng để
          tạo.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          {missing.includes("Lớp") && (
            <Link
              href="/dashboard/timetable/classes"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
            >
              → Tạo Lớp
            </Link>
          )}
          {missing.includes("Môn học") && (
            <Link
              href="/dashboard/timetable/subjects"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
            >
              → Tạo Môn học
            </Link>
          )}
          {missing.includes("Khung tiết") && (
            <Link
              href="/dashboard/timetable/periods"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
            >
              → Tạo Khung tiết
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <EditorClient
      classes={classes.data ?? []}
      subjects={subjects.data ?? []}
      periods={periods.data ?? []}
      teachers={teachers.data ?? []}
      initialSlots={slots.data ?? []}
      subjectTeachers={subjectTeachers.data ?? []}
      centerName={ctx?.tenant.name ?? "Trường / Trung tâm"}
    />
  );
}
