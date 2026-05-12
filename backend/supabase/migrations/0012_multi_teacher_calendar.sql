-- ============================================================================
-- VLearning — Multi-Teacher Calendar (Phase 2)
-- ============================================================================
-- Migration: 0012_multi_teacher_calendar.sql
--
-- Expands the single-teacher-per-tenant model so an edu center / school can
-- run one tenant with many teachers. Each "teacher slot" lives in
-- tenant_teachers; live_sessions gets a teacher_id pointing at it. Existing
-- single-teacher tenants are auto-backfilled into the new shape so nothing
-- breaks.
--
-- Profile linkage is OPTIONAL — a slot can exist without a logged-in user
-- (admin schedules for them; the admin manages the slot). When the teacher
-- later signs in, profile_id can be linked.
--
-- Depends on:
--   - 0002_init_tenant_auth.sql (tenants, profiles)
--   - 0008_create_live_sessions.sql (live_sessions)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. TENANT_TEACHERS TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- A "teacher slot" inside a tenant. The tenant owner (auth side) gets one of
-- these rows automatically with is_admin = true. Centers add additional rows
-- for their staff. profile_id is optional so a slot can exist before the
-- person ever signs in.

CREATE TABLE IF NOT EXISTS public.tenant_teachers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
    profile_id      UUID                 REFERENCES public.profiles(id) ON DELETE SET NULL,

    display_name    TEXT        NOT NULL,
    email           TEXT,                                  -- for future invitation flow
    color           TEXT        NOT NULL DEFAULT '#6366F1',-- 7-char hex, validated below
    is_admin        BOOLEAN     NOT NULL DEFAULT FALSE,    -- admin = can manage all sessions + slots
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tenant_teachers_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

COMMENT ON TABLE  public.tenant_teachers IS 'A teacher slot inside a tenant. Admin-owned; profile_id optional.';
COMMENT ON COLUMN public.tenant_teachers.profile_id IS 'Linked auth profile. NULL = slot not yet claimed by a logged-in user.';
COMMENT ON COLUMN public.tenant_teachers.color IS 'Hex color used to differentiate this teacher in the calendar grid.';
COMMENT ON COLUMN public.tenant_teachers.is_admin IS 'Tenant-level admin: can manage other teacher slots and any session.';

-- One profile can occupy at most one slot per tenant. Partial index because
-- profile_id is nullable and we don't want NULLs to collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_teachers_tenant_profile
    ON public.tenant_teachers(tenant_id, profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_teachers_tenant
    ON public.tenant_teachers(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_teachers_profile
    ON public.tenant_teachers(profile_id)
    WHERE profile_id IS NOT NULL;

-- updated_at trigger reuses the shared helper from 00001_initial_schema.sql.
CREATE OR REPLACE TRIGGER on_tenant_teachers_updated
    BEFORE UPDATE ON public.tenant_teachers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. LIVE_SESSIONS.TEACHER_ID
-- ────────────────────────────────────────────────────────────────────────────
-- Nullable so legacy rows can exist if backfill skips any. Default behavior
-- in the UI when teacher_id IS NULL = "treat as the tenant owner / admin."

ALTER TABLE public.live_sessions
    ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.tenant_teachers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.live_sessions.teacher_id IS 'The teacher slot this session belongs to. NULL = owned by the tenant admin (legacy).';

CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher
    ON public.live_sessions(teacher_id)
    WHERE teacher_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. BACKFILL — every existing tenant gets a slot for its owner
-- ────────────────────────────────────────────────────────────────────────────

-- 3a. Insert one tenant_teacher row per tenant pointing at its owner.
--     ON CONFLICT to make this rerunnable.
INSERT INTO public.tenant_teachers (tenant_id, profile_id, display_name, is_admin, color)
SELECT
    t.id,
    t.owner_id,
    COALESCE(NULLIF(p.display_name, ''), 'Giáo viên'),
    TRUE,
    '#4F46E5'
FROM public.tenants t
LEFT JOIN public.profiles p ON p.id = t.owner_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_teachers tt
    WHERE tt.tenant_id = t.id AND tt.profile_id = t.owner_id
);

-- 3b. Point every existing live_session at its owner's teacher slot.
UPDATE public.live_sessions ls
SET teacher_id = tt.id
FROM public.tenant_teachers tt
JOIN public.tenants t ON t.id = tt.tenant_id
WHERE tt.tenant_id = ls.tenant_id
  AND tt.profile_id = t.owner_id
  AND ls.teacher_id IS NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────────────────
-- Centralised auth checks so RLS policies stay readable. Both run with the
-- caller's privileges (no SECURITY DEFINER) — they only consult tables the
-- caller already has read access to via other policies.

-- Returns TRUE if auth.uid() is an admin in the given tenant. The tenant
-- owner is always considered an admin even if no tenant_teachers row exists
-- yet (defensive, in case the backfill is skipped on some env).
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenants
        WHERE id = p_tenant_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.tenant_teachers
        WHERE tenant_id = p_tenant_id
          AND profile_id = auth.uid()
          AND is_admin = TRUE
          AND is_active = TRUE
    );
$$;

-- Returns the tenant_teachers.id matching auth.uid() in p_tenant_id, or NULL
-- if the caller has no slot.
CREATE OR REPLACE FUNCTION public.current_tenant_teacher_id(p_tenant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT id FROM public.tenant_teachers
    WHERE tenant_id = p_tenant_id
      AND profile_id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. RLS — tenant_teachers
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_teachers ENABLE ROW LEVEL SECURITY;

-- Anyone in the tenant (admin or not) can read the slot list — the calendar
-- needs it to render colors and filter chips for everyone.
CREATE POLICY "tenant_teachers: tenant member read"
    ON public.tenant_teachers
    FOR SELECT
    TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );

-- Only tenant admins can add / edit / remove slots.
CREATE POLICY "tenant_teachers: admin insert"
    ON public.tenant_teachers
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "tenant_teachers: admin update"
    ON public.tenant_teachers
    FOR UPDATE
    TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "tenant_teachers: admin delete"
    ON public.tenant_teachers
    FOR DELETE
    TO authenticated
    USING (public.is_tenant_admin(tenant_id));


-- ────────────────────────────────────────────────────────────────────────────
-- 6. RLS — live_sessions (replace the single-teacher policy)
-- ────────────────────────────────────────────────────────────────────────────
-- The old "teacher manage own" policy keyed off tenants.owner_id only. Drop
-- it and split into separate read / write so non-admin teachers can read
-- everything in their tenant but only mutate their own sessions.

DROP POLICY IF EXISTS "live_sessions: teacher manage own" ON public.live_sessions;

-- Read: any active member of the tenant (admin or teacher slot).
CREATE POLICY "live_sessions: tenant member read"
    ON public.live_sessions
    FOR SELECT
    TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );

-- Insert / update / delete:
--   • admin → any session in the tenant
--   • non-admin teacher → only sessions where teacher_id = their slot
CREATE POLICY "live_sessions: admin write"
    ON public.live_sessions
    FOR ALL
    TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "live_sessions: own teacher write"
    ON public.live_sessions
    FOR ALL
    TO authenticated
    USING (teacher_id = public.current_tenant_teacher_id(tenant_id))
    WITH CHECK (teacher_id = public.current_tenant_teacher_id(tenant_id));


-- ============================================================================
-- ROLLBACK NOTES (for reference — do not include in forward migration)
-- ============================================================================
-- DROP POLICY ... on live_sessions, restore the single "teacher manage own"
-- policy from 0008_create_live_sessions.sql, then:
--   ALTER TABLE public.live_sessions DROP COLUMN teacher_id;
--   DROP TABLE public.tenant_teachers CASCADE;
--   DROP FUNCTION public.is_tenant_admin(UUID);
--   DROP FUNCTION public.current_tenant_teacher_id(UUID);
-- ============================================================================


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ tenant_teachers table — admin-owned roster of teacher slots
-- ✅ live_sessions.teacher_id column (nullable, indexed)
-- ✅ Backfill — owner slot per tenant + teacher_id on existing sessions
-- ✅ Helper functions — is_tenant_admin, current_tenant_teacher_id
-- ✅ RLS — tenant_teachers (admin-write, member-read); live_sessions
--    (member-read, admin-write-all, teacher-write-own)
-- ============================================================================
