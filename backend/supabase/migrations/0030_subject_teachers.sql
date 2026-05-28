-- ============================================================================
-- VLearning — Subject ↔ teacher (giáo viên bộ môn)
-- ============================================================================
-- Migration: 0030_subject_teachers.sql
--
-- One subject can be taught by many teachers; one teacher can teach many
-- subjects. Junction table — clean cascade, indexable both directions,
-- matches how Vietnamese schools think about "tổ bộ môn" (subject group).
--
-- Used by the timetable grid editor: when the admin picks a subject for a
-- cell, the teacher dropdown surfaces qualified teachers first; the class's
-- homeroom teacher is also defaulted when they're in the qualified set.
-- Non-qualified teachers can still be assigned (admin override).
--
-- Depends on:
--   - 0029_timetable.sql                (subjects)
--   - 0012_multi_teacher_calendar.sql   (tenant_teachers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subject_teachers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id)         ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES public.subjects(id)        ON DELETE CASCADE,
    teacher_id  UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subject_teachers_unique UNIQUE (subject_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_teachers_subject
    ON public.subject_teachers(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_teacher
    ON public.subject_teachers(teacher_id);


-- ────────────────────────────────────────────────────────────────────────────
-- RLS — same shape as the rest of the timetable family
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.subject_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subject_teachers: member read" ON public.subject_teachers;
DROP POLICY IF EXISTS "subject_teachers: admin write" ON public.subject_teachers;

CREATE POLICY "subject_teachers: member read"
    ON public.subject_teachers
    FOR SELECT
    TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );

CREATE POLICY "subject_teachers: admin write"
    ON public.subject_teachers
    FOR ALL
    TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));
