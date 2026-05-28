import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { renderToBuffer } from "@react-pdf/renderer";

import {
  TkbPdfDocument,
  ensureFonts,
} from "@/modules/timetable/TkbPdfDocument";
import type {
  ClassRow,
  PeriodRow,
  SubjectRow,
  TimetableSlotRow,
} from "@/modules/timetable/types";
import type { TenantTeacherRow } from "@/types/database";

/**
 * Public TKB PDF.
 *
 *   GET /tkb/[token]/[grade]
 *
 * QR codes resolve here. Students/parents scan → phone opens this URL →
 * browser displays the PDF inline (or downloads + opens in PDF reader).
 *
 * No auth required. Service-role client reads only the rows belonging to
 * the token's tenant. Cache-Control is set short so a freshly-edited slot
 * is visible within the next scan but we don't re-render on every request.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

function createNoCacheAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...init, cache: "no-store" }),
    },
  });
}

async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

interface RouteContext {
  params: Promise<{ token: string; grade: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { token, grade: gradeStr } = await ctx.params;
  const grade = parseInt(gradeStr, 10);
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
    return new Response("Invalid grade", { status: 400 });
  }

  const admin = createNoCacheAdminClient();

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, name, public_tkb_token")
    .eq("public_tkb_token", token)
    .maybeSingle();
  if (tenantErr) {
    console.error("[public-tkb-pdf] tenant lookup error", tenantErr);
  }
  if (!tenant) {
    return new Response("Not found", { status: 404 });
  }

  const [classesRes, periodsRes, slotsRes, teachersRes, subjectsRes] =
    await Promise.all([
      admin.from("classes").select("*").eq("tenant_id", tenant.id),
      admin
        .from("periods")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("period_number", { ascending: true }),
      admin.from("timetable_slots").select("*").eq("tenant_id", tenant.id),
      admin
        .from("tenant_teachers")
        .select("*")
        .eq("tenant_id", tenant.id),
      admin.from("subjects").select("*").eq("tenant_id", tenant.id),
    ]);

  const allClasses = (classesRes.data ?? []) as ClassRow[];
  const classes = allClasses.filter((c) => c.grade_level === grade);
  const classIds = new Set(classes.map((c) => c.id));
  const allSlots = (slotsRes.data ?? []) as TimetableSlotRow[];
  const slots = allSlots.filter((s) => classIds.has(s.class_id));

  const sortedClasses = [...classes].sort((a, b) =>
    a.name.localeCompare(b.name, "vi", { numeric: true }),
  );

  // Fonts need an absolute URL when registered server-side — there's no
  // `window.location.origin`. We compute it from the incoming Host header.
  const origin = await resolveOrigin();
  ensureFonts(origin);

  // Current academic year + semester (matches editor's `currentAcademic`).
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const yearLabel = m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const semester: 1 | 2 = m >= 7 ? 1 : 2;

  const buffer = await renderToBuffer(
    <TkbPdfDocument
      centerName={tenant.name}
      yearLabel={yearLabel}
      semester={semester}
      tkbNumber={1}
      grade={grade}
      classes={sortedClasses}
      periods={(periodsRes.data ?? []) as PeriodRow[]}
      slots={slots}
      subjects={(subjectsRes.data ?? []) as SubjectRow[]}
      teachers={(teachersRes.data ?? []) as TenantTeacherRow[]}
      effectiveDate={now}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // `inline` so the browser displays it instead of forcing download.
      // Filename used if the user chooses Save.
      "Content-Disposition": `inline; filename="TKB_Khoi${grade}.pdf"`,
      // Short cache so QR scans are responsive but always reflect the
      // latest editor changes within a few seconds of being re-scheduled.
      "Cache-Control": "public, max-age=10, must-revalidate",
    },
  });
}
