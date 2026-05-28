-- ============================================================================
-- VLearning — live_sessions.course_id becomes optional
-- ============================================================================
-- Migration: 0021_live_sessions_course_optional.sql
--
-- Per CLAUDE.md §4, the legacy `courses` table is deprecated — the new
-- equivalent is `modules/classes/` (PRD §6), which isn't migrated yet.
-- Forcing every session to bind to a course creates a chicken-and-egg
-- block: brand-new tenants have zero courses and no UI to create one,
-- so they can't schedule any session.
--
-- This migration drops the NOT NULL on course_id (the FK stays, with its
-- ON DELETE CASCADE behavior — when a course IS linked and later deleted,
-- the session still goes with it). When `classes` lands, sessions will
-- add an optional class_id alongside; legacy course_id values keep working
-- until a future cleanup migration removes them.
--
-- Depends on:
--   - 0008_create_live_sessions.sql
-- ============================================================================

ALTER TABLE public.live_sessions
    ALTER COLUMN course_id DROP NOT NULL;

COMMENT ON COLUMN public.live_sessions.course_id IS
    'Optional link to the legacy courses table (deprecated per PRD §4). NULL means the session is standalone — typical for v1 centers that don''t use the LMS-shaped courses model. Will be replaced by class_id when the classes table lands.';

-- The student-facing RLS policy (live_sessions: student read enrolled) checks
-- enrollments.course_id = live_sessions.course_id. A NULL course_id won't
-- match any enrollment, so standalone sessions are invisible to students —
-- correct behavior for v1 where students aren't the audience.
