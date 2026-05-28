import { redirect } from "next/navigation";

/** Landing → redirects into the first tab. */
export default function TimetableIndex() {
  redirect("/dashboard/timetable/classes");
}
