import { listClasses } from "@/modules/timetable/actions";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import ClassesPanel from "./_components/ClassesPanel";

export default async function ClassesPage() {
  const [classesRes, teachersRes] = await Promise.all([
    listClasses(),
    getTenantTeachers(),
  ]);
  return (
    <ClassesPanel
      initialClasses={classesRes.data ?? []}
      teachers={teachersRes.data ?? []}
    />
  );
}
