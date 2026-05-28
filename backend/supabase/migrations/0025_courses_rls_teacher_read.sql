-- ============================================================================
-- VLearning — Courses RLS: allow tenant teachers to read
-- ============================================================================
-- Migration: 0025_courses_rls_teacher_read.sql
--
-- Symptom: a non-admin teacher opens a session on the calendar and the
-- "Khóa học" field shows "—" even though the session row clearly has a
-- course_id. After editing the session it still shows "—" (looks like the
-- course disappeared, but really the embedded courses join is returning
-- NULL all along because RLS blocks the read).
--
-- Root cause: 0004_courses_add_tenant_id.sql created a SELECT policy
-- "courses: owner read all" gated on tenants.owner_id = auth.uid(). There
-- is no policy for non-admin teachers, so they can't read any courses in
-- their own tenant even though they teach against them.
--
-- Fix: add a second permissive SELECT policy. Postgres OR-combines RLS
-- policies, so the owner policy keeps working; we just widen the read
-- audience to include active tenant_teachers rows.
--
-- Same fix incidentally restores the "Khóa học" dropdown in the
-- CreateSessionModal for teachers (it was empty for non-admins for the
-- same reason).
--
-- Depends on:
--   - 0004_courses_add_tenant_id.sql
--   - 0012_multi_teacher_calendar.sql  (tenant_teachers)
-- ============================================================================

DROP POLICY IF EXISTS "courses: tenant teacher read" ON public.courses;

CREATE POLICY "courses: tenant teacher read"
    ON public.courses
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tt.tenant_id
            FROM public.tenant_teachers tt
            WHERE tt.profile_id = auth.uid()
              AND tt.is_active  = TRUE
        )
    );

COMMENT ON POLICY "courses: tenant teacher read" ON public.courses IS
    'Allows any active tenant_teachers member to read courses in their tenant. Pairs with the existing owner-read policy so admins and teachers both see the catalog. WRITE policies are unchanged — only the owner can create/update/delete courses.';
