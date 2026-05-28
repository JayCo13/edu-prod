import { listPeriods } from "@/modules/timetable/actions";
import PeriodsPanel from "./_components/PeriodsPanel";

export default async function PeriodsPage() {
  const res = await listPeriods();
  return <PeriodsPanel initialPeriods={res.data ?? []} />;
}
