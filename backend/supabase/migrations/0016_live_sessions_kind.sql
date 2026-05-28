-- ============================================================================
-- VLearning — live_sessions.kind (recurring vs one-off classification)
-- ============================================================================
-- Migration: 0016_live_sessions_kind.sql
--
-- Adds a `kind` column to live_sessions so center admins can classify a
-- session as a long-term, recurring meeting ("định kỳ") vs a one-off
-- ("một lần"). This is a **classification tag only** — it does not
-- auto-generate weekly copies. A future migration may introduce a proper
-- `class_templates` table to materialise recurring schedules.
--
-- Depends on:
--   - 0008_create_live_sessions.sql
-- ============================================================================

ALTER TABLE public.live_sessions
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'one_off'
        CHECK (kind IN ('recurring', 'one_off'));

COMMENT ON COLUMN public.live_sessions.kind IS
    'Classification tag: ''recurring'' = long-term/định kỳ, ''one_off'' = one-time/một lần. Does not drive automatic series generation in v1.';

-- Index supports admin views filtering to long-term sessions in a center.
CREATE INDEX IF NOT EXISTS idx_live_sessions_kind
    ON public.live_sessions(tenant_id, kind)
    WHERE is_cancelled = FALSE;
