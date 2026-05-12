-- ============================================================================
-- VLearning — Create Modules + Alter Lessons for Curriculum Builder
-- ============================================================================
-- Migration: 0005_create_modules_alter_lessons.sql
--
-- This migration introduces the Curriculum Builder schema:
--   1. Creates `lesson_type` enum
--   2. Creates `modules` table (chapter containers)
--   3. Alters `lessons` table to link to modules
--   4. Sets up RLS for tenant-scoped access
--
-- Depends on:
--   - 00001_initial_schema.sql (courses, lessons tables)
--   - 0002_init_tenant_auth.sql (tenants table)
--   - 0004_courses_add_tenant_id.sql (courses.tenant_id, existing lesson RLS)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CUSTOM TYPES
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE public.lesson_type AS ENUM ('video', 'text', 'quiz');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. CREATE MODULES TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Modules are "chapters" that group lessons within a course.
-- Teachers drag-and-drop modules to reorder them.

CREATE TABLE IF NOT EXISTS public.modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    -- Content
    title           TEXT        NOT NULL,

    -- Ordering
    order_index     INTEGER     NOT NULL DEFAULT 0,

    -- Visibility
    is_published    BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.modules IS 'Chapter/section containers that group lessons within a course';
COMMENT ON COLUMN public.modules.order_index IS 'Sort position within course (0-based, managed by drag-and-drop)';
COMMENT ON COLUMN public.modules.is_published IS 'Whether students can see this module';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_modules_course_id
    ON public.modules(course_id);

CREATE INDEX IF NOT EXISTS idx_modules_course_order
    ON public.modules(course_id, order_index);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER on_modules_updated
    BEFORE UPDATE ON public.modules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 3. ALTER LESSONS TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Add module_id, lesson_type, is_published.
-- Rename sort_order → order_index for consistency.
-- Keep course_id for fast queries and backward compatibility.

-- 3a. Add module_id (nullable first — backfill later or leave NULL for orphans)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE;

-- 3b. Add lesson_type (default 'video' for existing lessons)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS lesson_type public.lesson_type NOT NULL DEFAULT 'video';

-- 3c. Add is_published
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

-- 3d. Rename sort_order → order_index (if sort_order exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lessons'
          AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE public.lessons RENAME COLUMN sort_order TO order_index;
    END IF;
END $$;

-- 3e. Ensure order_index exists (in case sort_order didn't exist)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_lessons_module_id
    ON public.lessons(module_id);

CREATE INDEX IF NOT EXISTS idx_lessons_module_order
    ON public.lessons(module_id, order_index);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY — MODULES
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- 4a. Public can read modules of published courses
CREATE POLICY "modules: public read published"
    ON public.modules
    FOR SELECT
    USING (
        is_published = TRUE
        AND course_id IN (
            SELECT id FROM public.courses WHERE status = 'published'
        )
    );

-- 4b. Tenant owner can read ALL their modules (including unpublished)
CREATE POLICY "modules: owner read all"
    ON public.modules
    FOR SELECT
    USING (
        course_id IN (
            SELECT c.id FROM public.courses c
            JOIN public.tenants t ON c.tenant_id = t.id
            WHERE t.owner_id = auth.uid()
        )
    );

-- 4c. Tenant owner can create modules in their courses
CREATE POLICY "modules: owner insert"
    ON public.modules
    FOR INSERT
    WITH CHECK (
        course_id IN (
            SELECT c.id FROM public.courses c
            JOIN public.tenants t ON c.tenant_id = t.id
            WHERE t.owner_id = auth.uid()
        )
    );

-- 4d. Tenant owner can update their modules
CREATE POLICY "modules: owner update"
    ON public.modules
    FOR UPDATE
    USING (
        course_id IN (
            SELECT c.id FROM public.courses c
            JOIN public.tenants t ON c.tenant_id = t.id
            WHERE t.owner_id = auth.uid()
        )
    );

-- 4e. Tenant owner can delete their modules
CREATE POLICY "modules: owner delete"
    ON public.modules
    FOR DELETE
    USING (
        course_id IN (
            SELECT c.id FROM public.courses c
            JOIN public.tenants t ON c.tenant_id = t.id
            WHERE t.owner_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY — LESSONS (updated for modules)
-- ────────────────────────────────────────────────────────────────────────────
-- Drop existing policies from migration 0004 and recreate with module support.

DROP POLICY IF EXISTS "lessons: owner full access" ON public.lessons;
DROP POLICY IF EXISTS "lessons: public read via published course" ON public.lessons;

-- Also drop policies from initial migration (0001) if they exist
DROP POLICY IF EXISTS "lessons: public read previews" ON public.lessons;
DROP POLICY IF EXISTS "lessons: enrolled student read" ON public.lessons;
DROP POLICY IF EXISTS "lessons: teacher read own" ON public.lessons;
DROP POLICY IF EXISTS "lessons: teacher insert" ON public.lessons;
DROP POLICY IF EXISTS "lessons: teacher update own" ON public.lessons;
DROP POLICY IF EXISTS "lessons: teacher delete own" ON public.lessons;

-- 5a. Public can read published lessons of published courses
CREATE POLICY "lessons: public read published"
    ON public.lessons
    FOR SELECT
    USING (
        is_published = TRUE
        AND course_id IN (
            SELECT id FROM public.courses WHERE status = 'published'
        )
    );

-- 5b. Enrolled students can view lessons of their purchased courses
CREATE POLICY "lessons: enrolled student read"
    ON public.lessons
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.course_id = lessons.course_id
            AND enrollments.student_id = auth.uid()
            AND enrollments.payment_status = 'completed'
        )
    );

-- 5c. Tenant owner full access to their lessons
CREATE POLICY "lessons: owner full access"
    ON public.lessons
    FOR ALL
    USING (
        course_id IN (
            SELECT c.id FROM public.courses c
            JOIN public.tenants t ON c.tenant_id = t.id
            WHERE t.owner_id = auth.uid()
        )
    );


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ lesson_type enum created (video, text, quiz)
-- ✅ modules table created with course_id FK
-- ✅ lessons table altered: +module_id, +lesson_type, +is_published, sort_order→order_index
-- ✅ RLS: modules (public read published, owner CRUD)
-- ✅ RLS: lessons (rebuilt — public read published, enrolled student, owner full)
-- ✅ Indexes for module_id, order_index lookups
-- ✅ Auto-update trigger for modules.updated_at
-- ============================================================================
