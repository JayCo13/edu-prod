-- ============================================================================
-- VLearning — in-app notifications
-- ============================================================================
-- Migration: 0019_notifications.sql
--
-- Per-recipient inbox surfaced in the top-nav bell. v1 use case: when a
-- non-admin teacher schedules / edits their own live session, fan a row out
-- to every admin of the tenant. Future kinds (attendance flagged, payroll
-- approved, etc.) reuse the same table — see the `kind` enum below.
--
-- This is *not* an event log (use audit_logs for that). Notifications are
-- read+dismissed by their recipient; once everyone has read, the row stays
-- as history but no longer counts toward unread badges.
--
-- Depends on:
--   - 0002_init_tenant_auth.sql   (tenants)
--   - 0012_multi_teacher_calendar.sql  (tenant_teachers, is_tenant_admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Who receives this notification. Always an auth.users id.
    recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Who caused it. NULL = system. May be the recipient themselves in rare
    -- cases (e.g. self-action that still surfaces); we don't filter that out.
    actor_id        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_teacher_id UUID NULL REFERENCES public.tenant_teachers(id) ON DELETE SET NULL,

    -- Classification. Keep the set small and additive — UIs match on it for
    -- icon / copy. Adding a new kind is a one-line ALTER … ADD VALUE? — no,
    -- we use TEXT + CHECK so it's just a CHECK update.
    kind            TEXT NOT NULL CHECK (kind IN (
        'session_created',
        'session_updated',
        'session_cancelled'
    )),

    -- Polymorphic entity pointer. entity_type matches the table the entity
    -- lives in (e.g. 'live_session'); entity_id is its primary key. NULL when
    -- the notification isn't tied to a single row.
    entity_type     TEXT NULL,
    entity_id       UUID NULL,

    -- Rendering payload. Snapshot the fields the bell list needs (title,
    -- start_time, course_title, actor_display_name) so we don't re-join on
    -- read and so the message survives entity deletion.
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

    read_at         TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS
    'Per-recipient inbox for the in-app bell. Distinct from audit_logs (which is the immutable event log).';

-- Hot path: "unread for me in this tenant, newest first".
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON public.notifications(recipient_id, tenant_id, created_at DESC)
    WHERE read_at IS NULL;

-- Secondary: full inbox by recipient (read + unread).
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_all
    ON public.notifications(recipient_id, tenant_id, created_at DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
-- Recipients read + mark-read their own rows. Inserts come exclusively from
-- the server (service-role) so we don't expose a write policy to anon /
-- authenticated. Likewise no DELETE policy — deletion is admin-only via
-- service role if ever needed.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: recipient read own" ON public.notifications;
DROP POLICY IF EXISTS "notifications: recipient update own read_at" ON public.notifications;

CREATE POLICY "notifications: recipient read own"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid());

-- Recipient can flip read_at on their own rows (mark read / unread). We
-- enforce the recipient predicate on both USING and WITH CHECK so they
-- can't reassign rows.
CREATE POLICY "notifications: recipient update own read_at"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────
-- Helper view: admin recipient set per tenant
-- ────────────────────────────────────────────────────────────────────────────
-- Combines tenants.owner_id with tenant_teachers (is_admin=TRUE, active).
-- Lets server actions fan out without re-duplicating the union.

CREATE OR REPLACE VIEW public.tenant_admin_recipients AS
    SELECT t.id AS tenant_id, t.owner_id AS user_id
    FROM public.tenants t
    WHERE t.owner_id IS NOT NULL
    UNION
    SELECT tt.tenant_id, tt.profile_id AS user_id
    FROM public.tenant_teachers tt
    WHERE tt.is_admin = TRUE
      AND tt.is_active = TRUE
      AND tt.profile_id IS NOT NULL;

COMMENT ON VIEW public.tenant_admin_recipients IS
    'Union of tenant owners + is_admin tenant_teachers. Used by server-side notification fan-out.';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP VIEW public.tenant_admin_recipients;
-- DROP TABLE public.notifications;
-- ============================================================================
