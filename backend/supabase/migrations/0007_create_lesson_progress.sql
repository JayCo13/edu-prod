-- ============================================================================
-- VLearning — Lesson Progress Tracking
-- ============================================================================
-- Migration: 0007_create_lesson_progress.sql
--
-- Creates the lesson_progress table for tracking student completion.
-- Denormalizes course_id to avoid expensive multi-table JOINs when
-- computing progress percentages.
--
-- Depends on:
--   - 00001_initial_schema.sql (profiles, courses)
--   - 0005_create_modules_alter_lessons.sql (lessons)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CREATE LESSON_PROGRESS TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id       UUID        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    -- Progress
    is_completed    BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMPTZ DEFAULT NULL,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One progress row per user per lesson
    CONSTRAINT lesson_progress_unique_user_lesson UNIQUE (user_id, lesson_id)
);

COMMENT ON TABLE  public.lesson_progress IS 'Tracks per-lesson completion for each student';
COMMENT ON COLUMN public.lesson_progress.course_id IS 'Denormalized from lessons for fast progress queries';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────────────────────

-- Fast query: "How many lessons has user X completed in course Y?"
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course
    ON public.lesson_progress(user_id, course_id);

-- Fast query: "Which users completed lesson Z?" (for analytics)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson
    ON public.lesson_progress(lesson_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_lesson_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_lesson_progress_updated
    BEFORE UPDATE ON public.lesson_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_lesson_progress_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS POLICIES
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Students can read their own progress
CREATE POLICY "lesson_progress: student read own"
    ON public.lesson_progress
    FOR SELECT
    USING (auth.uid() = user_id);

-- Students can insert their own progress
CREATE POLICY "lesson_progress: student insert own"
    ON public.lesson_progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Students can update their own progress
CREATE POLICY "lesson_progress: student update own"
    ON public.lesson_progress
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Teachers can read progress for their courses (for analytics)
CREATE POLICY "lesson_progress: teacher read course"
    ON public.lesson_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.courses
            WHERE courses.id = lesson_progress.course_id
            AND courses.teacher_id = auth.uid()
        )
    );


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ lesson_progress table with denormalized course_id
-- ✅ Unique constraint (user_id, lesson_id)
-- ✅ Indexes for user+course and lesson queries
-- ✅ updated_at trigger
-- ✅ RLS: students own rows only, teachers can read their course data
-- ============================================================================
