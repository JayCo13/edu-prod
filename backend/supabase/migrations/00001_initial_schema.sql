-- ============================================================================
-- VLearning — Initial Database Schema (PostgreSQL / Supabase)
-- ============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Core tables, indexes, RLS policies, triggers, and storage
--              for a B2B SaaS White-label EdTech platform.
--
-- Run on Supabase:
--   1. Via Dashboard → SQL Editor → paste and execute
--   2. Via CLI: supabase db push
--
-- Conventions:
--   • UUID primary keys (gen_random_uuid())
--   • snake_case naming
--   • Timestamps default to now(), with auto-update trigger
--   • All tables have RLS enabled
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";         -- case-insensitive text (for emails/slugs)


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CUSTOM TYPES
-- ────────────────────────────────────────────────────────────────────────────

-- User role within the platform
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Course publication status
DO $$ BEGIN
    CREATE TYPE public.course_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────────────────

-- Auto-update `updated_at` column on row modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;


-- ============================================================================
-- CORE TABLES
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES — 1:1 with auth.users
-- ────────────────────────────────────────────────────────────────────────────
-- Extends Supabase Auth with platform-specific user data.
-- One row is auto-created per auth signup via trigger.

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identity
    display_name    TEXT        NOT NULL DEFAULT '',
    bio             TEXT        DEFAULT '',
    avatar_url      TEXT        DEFAULT '',

    -- White-label (teachers only)
    custom_domain   TEXT        UNIQUE DEFAULT NULL,  -- e.g., "janedoe.vlearning.io"

    -- Role & Status
    role            public.user_role NOT NULL DEFAULT 'student',
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Extended user profiles (1:1 with auth.users)';
COMMENT ON COLUMN public.profiles.custom_domain IS 'White-label subdomain for teacher storefronts';
COMMENT ON COLUMN public.profiles.role IS 'Platform role: student, teacher, or admin';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. COURSES — Owned by teacher
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    teacher_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Content
    title           TEXT        NOT NULL,
    slug            CITEXT      NOT NULL,               -- URL-friendly (case-insensitive unique)
    description     TEXT        DEFAULT '',
    thumbnail_url   TEXT        DEFAULT '',

    -- Pricing
    price           NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency        TEXT        NOT NULL DEFAULT 'USD',

    -- Status
    status          public.course_status NOT NULL DEFAULT 'draft',
    is_public       BOOLEAN     NOT NULL DEFAULT FALSE,  -- Visible on storefront?

    -- Counters (denormalized for performance)
    lessons_count       INTEGER NOT NULL DEFAULT 0,
    enrollments_count   INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT courses_slug_teacher_unique UNIQUE (teacher_id, slug),
    CONSTRAINT courses_price_non_negative CHECK (price >= 0)
);

COMMENT ON TABLE  public.courses IS 'Online courses created by teachers';
COMMENT ON COLUMN public.courses.slug IS 'URL-friendly identifier, unique per teacher';
COMMENT ON COLUMN public.courses.is_public IS 'Whether the course appears on the public storefront';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. LESSONS — Belongs to course
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    -- Content
    title           TEXT        NOT NULL,
    description     TEXT        DEFAULT '',
    video_url_token TEXT        DEFAULT '',              -- Points to secure_videos bucket object

    -- Ordering & Meta
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    duration_seconds INTEGER    DEFAULT 0,
    is_preview      BOOLEAN     NOT NULL DEFAULT FALSE,  -- Free preview lesson?

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.lessons IS 'Individual lessons/lectures within a course';
COMMENT ON COLUMN public.lessons.video_url_token IS 'Storage object path in the secure_videos bucket';
COMMENT ON COLUMN public.lessons.is_preview IS 'If true, lesson is viewable without enrollment';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. ENROLLMENTS — Student ↔ Course (junction table)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    student_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    -- Payment tracking
    payment_status  TEXT        NOT NULL DEFAULT 'completed',  -- completed, refunded, pending
    payment_amount  NUMERIC(10, 2) DEFAULT 0.00,
    payment_provider TEXT       DEFAULT '',                     -- e.g., "lemon_squeezy", "stripe"
    payment_ref     TEXT        DEFAULT '',                     -- External transaction ID

    -- Progress
    progress_pct    SMALLINT    NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    completed_at    TIMESTAMPTZ DEFAULT NULL,

    -- Timestamps
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT enrollments_unique_student_course UNIQUE (student_id, course_id)
);

COMMENT ON TABLE  public.enrollments IS 'Records which students have access to which courses';
COMMENT ON COLUMN public.enrollments.progress_pct IS 'Course completion percentage (0-100)';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role
    ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_custom_domain
    ON public.profiles(custom_domain)
    WHERE custom_domain IS NOT NULL;

-- Courses
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id
    ON public.courses(teacher_id);

CREATE INDEX IF NOT EXISTS idx_courses_status_public
    ON public.courses(status, is_public)
    WHERE status = 'published' AND is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_courses_slug
    ON public.courses(slug);

-- Lessons
CREATE INDEX IF NOT EXISTS idx_lessons_course_id_sort
    ON public.lessons(course_id, sort_order);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id
    ON public.enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id
    ON public.enrollments(course_id);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on profiles
CREATE OR REPLACE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on courses
CREATE OR REPLACE TRIGGER on_courses_updated
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update updated_at on lessons
CREATE OR REPLACE TRIGGER on_lessons_updated
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on new auth.users signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Supabase gates all client access through RLS.
-- `auth.uid()` returns the current user's UUID (from JWT).
-- `anon` = unauthenticated, `authenticated` = logged-in user.


-- ────────────────────────────────────────────────────────────────────────────
-- PROFILES: RLS Policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profile data (for teacher profile pages)
CREATE POLICY "profiles: public read"
    ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- Users can update only their own profile
CREATE POLICY "profiles: owner update"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Prevent direct inserts (handled by trigger on auth.users)
-- Prevent direct deletes (cascade from auth.users)


-- ────────────────────────────────────────────────────────────────────────────
-- COURSES: RLS Policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can view published + public courses
CREATE POLICY "courses: public read published"
    ON public.courses
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'published'
        AND is_public = TRUE
    );

-- Teachers can also see ALL their own courses (including drafts)
CREATE POLICY "courses: teacher read own"
    ON public.courses
    FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Teachers can create courses (teacher_id must match their UID)
CREATE POLICY "courses: teacher insert"
    ON public.courses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('teacher', 'admin')
        )
    );

-- Teachers can update only their own courses
CREATE POLICY "courses: teacher update own"
    ON public.courses
    FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Teachers can delete only their own courses
CREATE POLICY "courses: teacher delete own"
    ON public.courses
    FOR DELETE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('teacher', 'admin')
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- LESSONS: RLS Policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Anyone can view FREE PREVIEW lessons of published courses
CREATE POLICY "lessons: public read previews"
    ON public.lessons
    FOR SELECT
    TO anon, authenticated
    USING (
        is_preview = TRUE
        AND EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lessons.course_id
            AND courses.status = 'published'
            AND courses.is_public = TRUE
        )
    );

-- Enrolled students can view ALL lessons of their purchased courses
CREATE POLICY "lessons: enrolled student read"
    ON public.lessons
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.course_id = lessons.course_id
            AND enrollments.student_id = auth.uid()
            AND enrollments.payment_status = 'completed'
        )
    );

-- Teachers can view ALL lessons of their own courses
CREATE POLICY "lessons: teacher read own"
    ON public.lessons
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lessons.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Teachers can create lessons in their own courses
CREATE POLICY "lessons: teacher insert"
    ON public.lessons
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Teachers can update lessons in their own courses
CREATE POLICY "lessons: teacher update own"
    ON public.lessons
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lessons.course_id
            AND courses.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lessons.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Teachers can delete lessons from their own courses
CREATE POLICY "lessons: teacher delete own"
    ON public.lessons
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lessons.course_id
            AND courses.teacher_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- ENROLLMENTS: RLS Policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "enrollments: student read own"
    ON public.enrollments
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

-- Teachers can view enrollments for their courses (for analytics)
CREATE POLICY "enrollments: teacher read own courses"
    ON public.enrollments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Enrollments are created by server/webhook only (service_role key).
-- Students should NOT be able to self-enroll without payment verification.
-- INSERT is restricted to service_role (no client-side policy).

-- Students can update their own enrollment progress
CREATE POLICY "enrollments: student update progress"
    ON public.enrollments
    FOR UPDATE
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());


-- ============================================================================
-- SUPABASE STORAGE — Bucket Configuration
-- ============================================================================
-- Supabase Storage uses the `storage` schema.
-- Buckets and their RLS policies are configured via SQL.


-- ────────────────────────────────────────────────────────────────────────────
-- BUCKET: public_assets (PUBLIC)
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Avatar images, course thumbnails, public marketing assets.
-- Access:  Anyone can READ. Authenticated users can upload their own.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'public_assets',
    'public_assets',
    TRUE,                                                   -- Publicly accessible
    5242880,                                                -- 5 MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Anyone can view public assets
CREATE POLICY "public_assets: public read"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'public_assets');

-- Policy: Authenticated users can upload to their own folder (uid/*)
CREATE POLICY "public_assets: auth upload own"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'public_assets'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

-- Policy: Users can update/delete their own uploaded files
CREATE POLICY "public_assets: auth manage own"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'public_assets'
        AND owner_id = auth.uid()::TEXT
    );

CREATE POLICY "public_assets: auth delete own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'public_assets'
        AND owner_id = auth.uid()::TEXT
    );


-- ────────────────────────────────────────────────────────────────────────────
-- BUCKET: secure_videos (PRIVATE)
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Course lesson videos (private, paid content).
-- Access:  Only enrolled students + course owner can view.
--          Only teachers can upload (to their own folder).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'secure_videos',
    'secure_videos',
    FALSE,                                                  -- Private bucket
    524288000,                                              -- 500 MB max per file
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'application/x-mpegURL']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Teachers can upload videos to their own folder (teacher_uid/*)
CREATE POLICY "secure_videos: teacher upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'secure_videos'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('teacher', 'admin')
        )
    );

-- Policy: Teachers can view/manage their own uploaded videos
CREATE POLICY "secure_videos: teacher read own"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'secure_videos'
        AND owner_id = auth.uid()::TEXT
    );

CREATE POLICY "secure_videos: teacher delete own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'secure_videos'
        AND owner_id = auth.uid()::TEXT
    );

-- Policy: Enrolled students can VIEW (download) videos of purchased courses
-- Video paths follow convention: {teacher_uid}/{course_id}/{filename}
CREATE POLICY "secure_videos: enrolled student read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'secure_videos'
        AND EXISTS (
            SELECT 1
            FROM public.lessons l
            JOIN public.enrollments e ON e.course_id = l.course_id
            WHERE e.student_id = auth.uid()
            AND e.payment_status = 'completed'
            AND l.video_url_token = name
        )
    );


-- ============================================================================
-- SEED DATA (Optional — for development only)
-- ============================================================================
-- Uncomment to insert sample data for local development.
-- DO NOT run in production.

/*
-- Sample teacher profile (requires an auth.users entry first)
-- INSERT INTO public.profiles (id, display_name, bio, role, custom_domain)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'Jane Doe',
--     'Senior educator with 10+ years of experience in online teaching.',
--     'teacher',
--     'janedoe.vlearning.io'
-- );

-- Sample course
-- INSERT INTO public.courses (teacher_id, title, slug, description, price, status, is_public)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'Introduction to Web Development',
--     'intro-web-dev',
--     'Learn HTML, CSS, and JavaScript from scratch.',
--     29.99,
--     'published',
--     TRUE
-- );
*/


-- ============================================================================
-- DONE
-- ============================================================================
-- ✅ 4 core tables created (profiles, courses, lessons, enrollments)
-- ✅ 7 indexes for query performance
-- ✅ 4 auto-update triggers (updated_at + new user profile)
-- ✅ 16 RLS policies enforcing access control
-- ✅ 2 storage buckets (public_assets, secure_videos) with policies
-- ============================================================================
