-- ============================================================================
-- VLearning — Live Sessions (Virtual Waiting Room)
-- ============================================================================
-- Migration: 0008_create_live_sessions.sql
--
-- Creates the live_sessions table for scheduling Zoom/Meet sessions.
-- Teachers create sessions linked to a course; students access them
-- through a Virtual Waiting Room with countdown + secure link reveal.
--
-- Depends on:
--   - 00001_initial_schema.sql (tenants, courses, enrollments)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CREATE LIVE_SESSIONS TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scoping
    tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id           UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    -- Session info
    title               TEXT        NOT NULL,
    description         TEXT        DEFAULT '',
    start_time          TIMESTAMPTZ NOT NULL,
    duration_minutes    INTEGER     NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    meeting_url         TEXT        NOT NULL,
    meeting_password    TEXT        DEFAULT NULL,

    -- Status
    is_cancelled        BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.live_sessions IS 'Scheduled live sessions (Zoom/Meet) linked to a course';
COMMENT ON COLUMN public.live_sessions.meeting_url IS 'External meeting URL (Zoom, Google Meet, etc.)';
COMMENT ON COLUMN public.live_sessions.meeting_password IS 'Optional meeting password, revealed only close to start_time';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────────────────────

-- Teacher queries: "Show me all sessions for my tenant"
CREATE INDEX IF NOT EXISTS idx_live_sessions_tenant
    ON public.live_sessions(tenant_id, start_time DESC);

-- Student queries: "Show me upcoming sessions for course X"
CREATE INDEX IF NOT EXISTS idx_live_sessions_course
    ON public.live_sessions(course_id, start_time ASC)
    WHERE is_cancelled = FALSE;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_live_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_live_sessions_updated
    BEFORE UPDATE ON public.live_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_live_sessions_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS POLICIES
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers: Full CRUD on their own tenant's sessions
CREATE POLICY "live_sessions: teacher manage own"
    ON public.live_sessions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = live_sessions.tenant_id
            AND tenants.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = live_sessions.tenant_id
            AND tenants.owner_id = auth.uid()
        )
    );

-- Students: Read sessions for courses they're enrolled in
CREATE POLICY "live_sessions: student read enrolled"
    ON public.live_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE enrollments.course_id = live_sessions.course_id
            AND enrollments.student_id = auth.uid()
            AND enrollments.payment_status = 'completed'
        )
    );


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ live_sessions table with tenant + course scoping
-- ✅ Indexes for tenant and course queries
-- ✅ updated_at trigger
-- ✅ RLS: teachers manage own, students read if enrolled
-- ============================================================================
