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
export type LessonType = "video" | "text" | "quiz";

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

export interface TenantRow {
  id: string;
  owner_id: string;
  name: string;
  subdomain: string;
  logo_url: string;
  description: string;
  is_public: boolean;
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

/* -------------------------------------------------------------------------- */
/*  Modules (mirrors public.modules)                                           */
/* -------------------------------------------------------------------------- */

export interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Lessons (mirrors public.lessons — updated for Curriculum Builder)           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Enrollments (mirrors public.enrollments)                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Live Sessions (mirrors public.live_sessions)                               */
/* -------------------------------------------------------------------------- */

export interface LiveSessionRow {
  id: string;
  tenant_id: string;
  course_id: string;
  teacher_id: string | null;
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  meeting_url: string;
  meeting_password: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Tenant Teachers (mirrors public.tenant_teachers — multi-teacher Phase 2)   */
/* -------------------------------------------------------------------------- */

export interface TenantTeacherRow {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  display_name: string;
  email: string | null;
  color: string;
  is_admin: boolean;
  is_active: boolean;
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

/* -------------------------------------------------------------------------- */
/*  Module Insert / Update shapes                                              */
/* -------------------------------------------------------------------------- */

export type ModuleInsert = Pick<ModuleRow, "title"> & {
  order_index?: number;
  is_published?: boolean;
};

export type ModuleUpdate = Partial<Pick<ModuleRow, "title" | "is_published">>;

/* -------------------------------------------------------------------------- */
/*  Lesson Insert / Update shapes                                              */
/* -------------------------------------------------------------------------- */

export type LessonInsert = Pick<LessonRow, "title"> & {
  lesson_type?: LessonType;
  order_index?: number;
  is_published?: boolean;
};

export type LessonUpdate = Partial<
  Pick<LessonRow, "title" | "lesson_type" | "is_published" | "content" | "video_url" | "video_duration" | "is_free_preview">
>;

/* -------------------------------------------------------------------------- */
/*  Composite Types (for UI)                                                   */
/* -------------------------------------------------------------------------- */

/** Module with its nested lessons — primary data shape for CurriculumBuilder */
export interface ModuleWithLessons extends ModuleRow {
  lessons: LessonRow[];
}

/** Payload for batch reordering after drag-and-drop */
export interface ReorderPayload {
  modules: { id: string; order_index: number }[];
  lessons: { id: string; module_id: string; order_index: number }[];
}

/* -------------------------------------------------------------------------- */
/*  Action Result (generic)                                                    */
/* -------------------------------------------------------------------------- */

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*  Lesson Progress (mirrors public.lesson_progress)                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Public types — safe subsets for student-facing pages                        */
/* -------------------------------------------------------------------------- */

/** Lesson data safe for public consumption (no content/video_url) */
export interface PublicLesson {
  id: string;
  title: string;
  lesson_type: LessonType;
  order_index: number;
  is_free_preview: boolean;
  video_duration: number;
  is_published: boolean;
}

/** Module with public-safe lessons for storefront/learning sidebar */
export interface PublicModuleWithLessons {
  id: string;
  title: string;
  order_index: number;
  is_published: boolean;
  lessons: PublicLesson[];
}

/** Full course details for storefront page */
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
