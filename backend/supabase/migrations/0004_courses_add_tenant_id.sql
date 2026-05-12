-- ============================================================================
-- VLearning — Add tenant_id to courses + RLS policies
-- ============================================================================
-- Migration: 0004_courses_add_tenant_id.sql
--
-- The `courses` table already exists with `teacher_id` (FK → profiles).
-- This migration:
--   1. Adds `tenant_id` column → FK to tenants
--   2. Backfills tenant_id from teacher_id → profiles.tenant_id → tenants
--   3. Makes tenant_id NOT NULL
--   4. Adds tenant-scoped RLS policies
--   5. Creates unique constraint (tenant_id, slug)
--
-- NOTE: teacher_id is KEPT for backward compatibility (enrollment queries etc.)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD tenant_id COLUMN (nullable first for backfill)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL tenant_id FROM EXISTING DATA
-- ────────────────────────────────────────────────────────────────────────────
-- Logic: courses.teacher_id → tenants.owner_id
-- (teacher_id IS the auth.uid that owns the tenant)

UPDATE public.courses c
SET tenant_id = t.id
FROM public.tenants t
WHERE c.teacher_id = t.owner_id
  AND c.tenant_id IS NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. INDEX + UNIQUE CONSTRAINT
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_courses_tenant_id
    ON public.courses(tenant_id);

-- Slug unique per tenant (not globally)
-- Only add if no courses with NULL tenant_id remain
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.courses WHERE tenant_id IS NULL) THEN
        ALTER TABLE public.courses
            ADD CONSTRAINT courses_tenant_slug_unique UNIQUE (tenant_id, slug);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY — COURSES
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (clean slate)
DROP POLICY IF EXISTS "courses: public read published" ON public.courses;
DROP POLICY IF EXISTS "courses: owner read all" ON public.courses;
DROP POLICY IF EXISTS "courses: owner insert" ON public.courses;
DROP POLICY IF EXISTS "courses: owner update" ON public.courses;
DROP POLICY IF EXISTS "courses: owner delete" ON public.courses;

-- 4a. Public can read published courses (marketplace)
CREATE POLICY "courses: public read published"
    ON public.courses
    FOR SELECT
    USING (status = 'published');

-- 4b. Tenant owner can read ALL their courses (including drafts)
CREATE POLICY "courses: owner read all"
    ON public.courses
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        )
    );

-- 4c. Tenant owner can create courses in their tenant
CREATE POLICY "courses: owner insert"
    ON public.courses
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        )
    );

-- 4d. Tenant owner can update their courses
CREATE POLICY "courses: owner update"
    ON public.courses
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        )
    );

-- 4e. Tenant owner can delete their courses
CREATE POLICY "courses: owner delete"
    ON public.courses
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY — LESSONS (inherited from course tenant)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons: owner full access" ON public.lessons;
DROP POLICY IF EXISTS "lessons: public read via published course" ON public.lessons;

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

CREATE POLICY "lessons: public read via published course"
    ON public.lessons
    FOR SELECT
    USING (
        course_id IN (
            SELECT id FROM public.courses WHERE status = 'published'
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY — ENROLLMENTS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments: student read own" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: teacher read own courses" ON public.enrollments;

-- Students can read their own enrollments
CREATE POLICY "enrollments: student read own"
    ON public.enrollments
    FOR SELECT
    USING (student_id = auth.uid());

-- Teachers can read enrollments for their courses
CREATE POLICY "enrollments: teacher read own courses"
    ON public.enrollments
    FOR SELECT
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
-- ✅ Added tenant_id column to existing courses table
-- ✅ Backfilled tenant_id from teacher_id → tenants.owner_id
-- ✅ Slug unique per tenant
-- ✅ RLS: courses, lessons, enrollments (tenant-scoped)
-- ✅ teacher_id KEPT for backward compatibility
-- ============================================================================
