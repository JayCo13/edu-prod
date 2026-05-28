import {
  listSubjectTeachers,
  listSubjects,
} from "@/modules/timetable/actions";
import { getTenantTeachers } from "@/app/actions/tenant-teachers";
import SubjectsPanel from "./_components/SubjectsPanel";

export default async function SubjectsPage() {
  const [subjects, teachers, links] = await Promise.all([
    listSubjects(),
    getTenantTeachers(),
    listSubjectTeachers(),
  ]);
  return (
    <SubjectsPanel
      initialSubjects={subjects.data ?? []}
      teachers={teachers.data ?? []}
      initialLinks={links.data ?? []}
    />
  );
}
