import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";

/**
 * SchoolDashboard data fetcher.
 *
 * Pulls just enough to render the SCHOOL-flavoured admin landing page —
 * roster counts, fill-rate of the timetable, "things to fix" hints, and
 * grade-level breakdown. All scoped to the active tenant.
 */

export interface SchoolDashboardData {
  counts: {
    classes: number;
    teachers: number;
    subjects: number;
    periods: number;
    filledSlots: number;
    totalSlots: number; // classes × VN school days × periods (rough capacity)
  };
  gradeBreakdown: {
    grade: number;
    classes: number;
    classesWithHomeroom: number;
    filledSlots: number;
  }[];
  todo: {
    classesWithoutHomeroom: { id: string; name: string }[];
    teachersWithoutRole: { id: string; display_name: string }[];
    gradesMissingSchedule: number[]; // grades with ≥1 class but 0 slots
  };
}

const VN_SCHOOL_DAY_COUNT = 6; // Mon–Sat

export async function getSchoolDashboardData(): Promise<SchoolDashboardData | null> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    return await fetchData(supabase, tenant.id);
  } catch {
    return null;
  }
}

async function fetchData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<SchoolDashboardData> {
  const [
    classesRes,
    teachersRes,
    subjectsRes,
    periodsRes,
    slotsRes,
    rolesRes,
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, grade_level, homeroom_teacher_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("tenant_teachers")
      .select("id, display_name, role_id, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("subjects")
      .select("id")
      .eq("tenant_id", tenantId),
    supabase
      .from("periods")
      .select("id")
      .eq("tenant_id", tenantId),
    supabase
      .from("timetable_slots")
      .select("id, class_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("teacher_roles")
      .select("id")
      .eq("tenant_id", tenantId),
  ]);

  const classes = (classesRes.data ?? []) as {
    id: string;
    name: string;
    grade_level: number | null;
    homeroom_teacher_id: string | null;
  }[];
  const teachers = (teachersRes.data ?? []) as {
    id: string;
    display_name: string;
    role_id: string | null;
    is_active: boolean;
  }[];
  const subjects = (subjectsRes.data ?? []) as { id: string }[];
  const periods = (periodsRes.data ?? []) as { id: string }[];
  const slots = (slotsRes.data ?? []) as { id: string; class_id: string }[];
  const hasAnyRoles = ((rolesRes.data ?? []) as { id: string }[]).length > 0;

  // ── Counts ──────────────────────────────────────────────────────────────
  const totalSlots =
    classes.length * VN_SCHOOL_DAY_COUNT * periods.length;
  const filledSlots = slots.length;

  // ── Grade breakdown ─────────────────────────────────────────────────────
  const slotsByClass = new Map<string, number>();
  for (const s of slots) {
    slotsByClass.set(s.class_id, (slotsByClass.get(s.class_id) ?? 0) + 1);
  }
  const gradeMap = new Map<number, { classes: number; withHr: number; filled: number }>();
  for (const c of classes) {
    const g = c.grade_level ?? 0;
    const entry = gradeMap.get(g) ?? { classes: 0, withHr: 0, filled: 0 };
    entry.classes += 1;
    if (c.homeroom_teacher_id) entry.withHr += 1;
    entry.filled += slotsByClass.get(c.id) ?? 0;
    gradeMap.set(g, entry);
  }
  const gradeBreakdown = Array.from(gradeMap.entries())
    .filter(([g]) => g > 0)
    .sort(([a], [b]) => a - b)
    .map(([grade, v]) => ({
      grade,
      classes: v.classes,
      classesWithHomeroom: v.withHr,
      filledSlots: v.filled,
    }));

  // ── Things to fix ───────────────────────────────────────────────────────
  const classesWithoutHomeroom = classes
    .filter((c) => !c.homeroom_teacher_id)
    .slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name }));

  // Teachers without role assigned. Only surface this if the tenant has at
  // least one role defined — otherwise the warning is noise for new tenants
  // that haven't set up roles yet.
  const teachersWithoutRole = hasAnyRoles
    ? teachers
        .filter((t) => !t.role_id)
        .slice(0, 6)
        .map((t) => ({ id: t.id, display_name: t.display_name }))
    : [];

  const gradesMissingSchedule: number[] = [];
  for (const g of gradeBreakdown) {
    if (g.classes > 0 && g.filledSlots === 0) {
      gradesMissingSchedule.push(g.grade);
    }
  }

  return {
    counts: {
      classes: classes.length,
      teachers: teachers.length,
      subjects: subjects.length,
      periods: periods.length,
      filledSlots,
      totalSlots,
    },
    gradeBreakdown,
    todo: {
      classesWithoutHomeroom,
      teachersWithoutRole,
      gradesMissingSchedule,
    },
  };
}
