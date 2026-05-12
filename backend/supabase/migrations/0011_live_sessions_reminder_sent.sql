-- ============================================================================
-- VLearning — Live Session reminder_sent flag
-- ============================================================================
-- Migration: 0011_live_sessions_reminder_sent.sql
-- Description: Adds a flag so the reminder-email worker can avoid double-sending.
--              Set TRUE once the "your class starts in 15 minutes" email has
--              been dispatched to enrolled students for this session.
-- ============================================================================

ALTER TABLE public.live_sessions
    ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.live_sessions.reminder_sent IS
    'Set TRUE once the start-of-class reminder email has been sent. Worker uses this to avoid duplicate sends.';

-- Index supports the worker query (find sessions to remind):
--   SELECT * FROM live_sessions
--   WHERE reminder_sent = FALSE
--     AND is_cancelled = FALSE
--     AND start_time BETWEEN now() + 15min AND now() + 30min
CREATE INDEX IF NOT EXISTS idx_live_sessions_pending_reminder
    ON public.live_sessions(start_time)
    WHERE reminder_sent = FALSE AND is_cancelled = FALSE;
