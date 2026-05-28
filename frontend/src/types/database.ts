/* ============================================================================
   VLearning — Supabase Database Types (Multi-tenant)
   ============================================================================
   Mirrors the actual PostgreSQL schema from `already1.sql`.
   ============================================================================ */

/* -------------------------------------------------------------------------- */
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

export type CourseStatus = "draft" | "published";
export type UserRole = "student" | "teacher" | "admin";
// [DEPRECATED per PRD §4.3] - hidden 2026-05-12 — LMS lesson types out of scope.
// export type LessonType = "video" | "text" | "quiz";

/* -------------------------------------------------------------------------- */
/*  Profiles (mirrors public.profiles)                                         */
/* -------------------------------------------------------------------------- */

export interface ProfileRow {
  id: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  custom_domain: string | null;
  role: UserRole;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Tenants (mirrors public.tenants)                                           */
/* -------------------------------------------------------------------------- */

/** Product face — chosen by the owner during onboarding. Affects nav + copy
 *  only; data isolation is still by tenant_id. Added by migration 0031. */
export type TenantKind = "CENTER" | "SCHOOL";

export interface TenantRow {
  id: string;
  owner_id: string;
  name: string;
  subdomain: string;
  logo_url: string;
  description: string;
  is_public: boolean;
  kind: TenantKind;
  /** Random UUID for public TKB sharing via /tkb/[token]/...
   *  Migration 0033. */
  public_tkb_token: string;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Courses (mirrors public.courses)                                           */
/*  NOTE: teacher_id (legacy) AND tenant_id (multi-tenant) both exist          */
/* -------------------------------------------------------------------------- */

export interface CourseRow {
  id: string;
  teacher_id: string;
  tenant_id: string | null;       // Added by migration 0004
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  price: number;
  currency: string;
  status: CourseStatus;
  is_public: boolean;
  lessons_count: number;
  enrollments_count: number;
  created_at: string;
  updated_at: string;
}

// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// LMS schema (modules, lessons, enrollments) is out of scope per PRD §1.4.
// Tables remain in the database (see backend/supabase/migrations) but the
// TypeScript types are commented out so active code doesn't depend on them.
// Originals preserved here for revival reference.
/*
export interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string;
  video_url_token: string;
  order_index: number;
  duration_seconds: number;
  is_preview: boolean;
  lesson_type: LessonType;
  is_published: boolean;
  content: string | null;
  video_url: string | null;
  video_duration: number;
  is_free_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  payment_status: string;
  payment_amount: number;
  payment_provider: string;
  payment_ref: string;
  progress_pct: number;
  completed_at: string | null;
  enrolled_at: string;
}
*/

/* -------------------------------------------------------------------------- */
/*  Live Sessions (mirrors public.live_sessions)                               */
/* -------------------------------------------------------------------------- */

/** Classification tag for a live session. `recurring` = long-term ("Định kỳ"),
 *  `one_off` = one-time ("Một lần"). Stored on `live_sessions.kind`. v1 is
 *  display-only — no automatic series generation. */
export type LiveSessionKind = "recurring" | "one_off";

export interface LiveSessionRow {
  id: string;
  tenant_id: string;
  /** Optional link to the legacy courses table (deprecated per CLAUDE.md §4).
   *  NULL means the session stands alone. Migration 0021 dropped NOT NULL. */
  course_id: string | null;
  teacher_id: string | null;
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  meeting_url: string;
  meeting_password: string | null;
  is_cancelled: boolean;
  kind: LiveSessionKind;
  /** UUID grouping all sessions created from one recurring submit; NULL for one-off. */
  series_id: string | null;
  /** Weeks span chosen at series creation, denormalised on every row in the series. NULL for one-off. */
  recurrence_weeks: number | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Notifications (mirrors public.notifications — in-app bell)                 */
/* -------------------------------------------------------------------------- */

/** Discriminator for the in-app bell. Keep in sync with the CHECK on
 *  `public.notifications.kind`. */
export type NotificationKind =
  | "session_created"
  | "session_updated"
  | "session_cancelled";

/** Payload schema by kind. Stored as JSONB; we type the read side so
 *  consumers don't reach into `any`. Keep these fields small and stable —
 *  they're a snapshot and won't be re-joined on read. */
export interface SessionNotificationPayload {
  title: string;
  start_time: string;
  course_title?: string | null;
  actor_display_name?: string | null;
  /** When kind=session_created with a recurring fan-out, how many instances. */
  series_count?: number | null;
}

export interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_teacher_id: string | null;
  kind: NotificationKind;
  entity_type: string | null;
  entity_id: string | null;
  payload: SessionNotificationPayload;
  read_at: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Tenant Teachers (mirrors public.tenant_teachers — multi-teacher Phase 2)   */
/* -------------------------------------------------------------------------- */

/** Manual payout methods — bank info each teacher registers so the admin
 *  knows where to transfer. Added by migration 0026. */
export interface TeacherPayoutMethodRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  /** Path inside Supabase Storage bucket `payout-qr`. NULL = no QR uploaded. */
  qr_image_path: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** How an admin marked a payroll item paid. NULL = not yet paid. */
export type PayrollItemPaymentMethod = "BANK_TRANSFER" | "CASH";

/** Mirrors modules/payroll/types.ts PaymentStructure. Added by migration 0022. */
export type TeacherPaymentStructure =
  | "HOURLY"
  | "PER_SESSION"
  | "FIXED_MONTHLY"
  | "HYBRID";

export interface TenantTeacherRow {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  display_name: string;
  email: string | null;
  color: string;
  is_admin: boolean;
  is_active: boolean;
  /** Payment rate fields — migration 0022. All money is integer đồng (VND). */
  payment_structure: TeacherPaymentStructure;
  hourly_rate: number;
  per_session_rate: number | null;
  fixed_monthly_amount: number | null;
  /** Vietnamese tax ID (MST). Shown on Excel payroll export. */
  tax_id: string | null;
  /** Position/title at the tenant — FK to teacher_roles (migration 0032).
   *  NULL = no role assigned. */
  role_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Tenant-scoped teacher role/position (Hiệu trưởng, Giáo viên, ...).
 *  Migration 0032. */
export interface TeacherRoleRow {
  id: string;
  tenant_id: string;
  name: string;
  short_code: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Insert / Update shapes                                                     */
/* -------------------------------------------------------------------------- */

export type CourseInsert = Pick<CourseRow, "title" | "description" | "price"> & {
  slug?: string;
  currency?: string;
  status?: CourseStatus;
  is_public?: boolean;
};

export type CourseUpdate = Partial<
  Pick<
    CourseRow,
    | "title"
    | "slug"
    | "description"
    | "thumbnail_url"
    | "price"
    | "currency"
    | "status"
    | "is_public"
  >
>;

// [DEPRECATED per PRD §4.3] - hidden 2026-05-12 — LMS module/lesson shapes.
/*
export type ModuleInsert = Pick<ModuleRow, "title"> & {
  order_index?: number;
  is_published?: boolean;
};

export type ModuleUpdate = Partial<Pick<ModuleRow, "title" | "is_published">>;

export type LessonInsert = Pick<LessonRow, "title"> & {
  lesson_type?: LessonType;
  order_index?: number;
  is_published?: boolean;
};

export type LessonUpdate = Partial<
  Pick<LessonRow, "title" | "lesson_type" | "is_published" | "content" | "video_url" | "video_duration" | "is_free_preview">
>;
*/

/* -------------------------------------------------------------------------- */
/*  Composite Types (for UI)                                                   */
/* -------------------------------------------------------------------------- */

// [DEPRECATED per PRD §4.3] - hidden 2026-05-12 — LMS curriculum-builder shapes.
/*
export interface ModuleWithLessons extends ModuleRow {
  lessons: LessonRow[];
}

export interface ReorderPayload {
  modules: { id: string; order_index: number }[];
  lessons: { id: string; module_id: string; order_index: number }[];
}
*/

/* -------------------------------------------------------------------------- */
/*  Action Result (generic)                                                    */
/* -------------------------------------------------------------------------- */

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
  /** Optional non-fatal note — the action succeeded but with a caveat
   *  (e.g., the row was created but the invite email failed). */
  warning?: string;
}

// [DEPRECATED per PRD §4.3] - hidden 2026-05-12
// LMS progress + student-facing course/module/lesson types. Out of scope per PRD §1.4.
/*
export interface LessonProgressRow {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicLesson {
  id: string;
  title: string;
  lesson_type: LessonType;
  order_index: number;
  is_free_preview: boolean;
  video_duration: number;
  is_published: boolean;
}

export interface PublicModuleWithLessons {
  id: string;
  title: string;
  order_index: number;
  is_published: boolean;
  lessons: PublicLesson[];
}

export interface PublicCourseDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  price: number;
  currency: string;
  status: CourseStatus;
  lessons_count: number;
  enrollments_count: number;
  tenant_id: string | null;
  teacher: {
    display_name: string;
    avatar_url: string;
    bio: string;
  } | null;
  modules: PublicModuleWithLessons[];
}
*/
