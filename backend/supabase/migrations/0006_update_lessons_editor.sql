-- ============================================================================
-- VLearning — Update Lessons for Dynamic Lesson Editor
-- ============================================================================
-- Migration: 0006_update_lessons_editor.sql
--
-- Adds columns to support the Lesson Editor feature:
--   - content (rich-text HTML for Text lessons)
--   - video_url (BunnyCDN/YouTube/Vimeo URL for Video lessons)
--   - video_duration (duration in seconds)
--   - is_free_preview (allow free preview without purchase)
--
-- Depends on:
--   - 0005_create_modules_alter_lessons.sql (modules + lessons restructure)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD CONTENT COLUMNS TO LESSONS
-- ────────────────────────────────────────────────────────────────────────────

-- Rich-text HTML content for "text" type lessons
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS content TEXT;

COMMENT ON COLUMN public.lessons.content IS 'Rich-text HTML content for text-type lessons';

-- Video URL (BunnyCDN, YouTube embed, Vimeo, direct MP4, etc.)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.lessons.video_url IS 'Video source URL (BunnyCDN, YouTube, Vimeo)';

-- Video duration in seconds (for progress tracking and display)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS video_duration INTEGER DEFAULT 0;

COMMENT ON COLUMN public.lessons.video_duration IS 'Video duration in seconds for progress display';

-- Free preview toggle — lets students preview this lesson without purchasing
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.lessons.is_free_preview IS 'Whether this lesson is viewable for free as a course preview';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ADD INDEX FOR FREE PREVIEW QUERIES
-- ────────────────────────────────────────────────────────────────────────────

-- Used by student-facing course pages to quickly fetch previewable lessons
CREATE INDEX IF NOT EXISTS idx_lessons_free_preview
    ON public.lessons(course_id)
    WHERE is_free_preview = TRUE;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ lessons.content (TEXT, nullable) — HTML for text lessons
-- ✅ lessons.video_url (TEXT, nullable) — video source URL
-- ✅ lessons.video_duration (INTEGER, default 0) — duration in seconds
-- ✅ lessons.is_free_preview (BOOLEAN, default false) — free preview toggle
-- ✅ Partial index for fast free-preview queries
-- ============================================================================
