-- ============================================================================
-- VLearning — live_sessions recurrence series
-- ============================================================================
-- Migration: 0017_live_sessions_recurrence.sql
--
-- Adds series_id + recurrence_weeks so that a "Định kỳ" session can fan out
-- into N weekly instances on creation. All instances share one series_id;
-- recurrence_weeks records the originally-chosen span and is denormalised
-- onto every row in the series (cheap and avoids a join for display).
--
-- v1 has no series-aware edit / cancel UX yet — a future migration may
-- introduce a `live_session_series` parent row when that lands.
--
-- Depends on:
--   - 0008_create_live_sessions.sql
--   - 0016_live_sessions_kind.sql
-- ============================================================================

ALTER TABLE public.live_sessions
    ADD COLUMN IF NOT EXISTS series_id UUID NULL,
    ADD COLUMN IF NOT EXISTS recurrence_weeks INTEGER NULL
        CHECK (recurrence_weeks IS NULL OR (recurrence_weeks BETWEEN 1 AND 52));

COMMENT ON COLUMN public.live_sessions.series_id IS
    'Groups instances created from one ''Định kỳ'' submit. NULL for ''Một lần''. Same UUID across all sessions in a series.';
COMMENT ON COLUMN public.live_sessions.recurrence_weeks IS
    'Span (in weeks) chosen at series-creation time. Denormalised onto every row in the series. NULL for ''Một lần''.';

-- Lets queries pull the whole series in one shot.
CREATE INDEX IF NOT EXISTS idx_live_sessions_series
    ON public.live_sessions(series_id)
    WHERE series_id IS NOT NULL;
