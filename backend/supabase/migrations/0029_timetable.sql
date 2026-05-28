-- ============================================================================
-- VLearning — School timetable model
-- ============================================================================
-- Migration: 0029_timetable.sql
--
-- Vietnamese-school "Thời khoá biểu" — a fixed weekly schedule. Distinct
-- from `live_sessions` (one-off / dated instances) — the timetable is the
-- TEMPLATE that admins use to print a class's recurring weekly plan and,
-- in a later cycle, fan out into actual live_sessions for a date range.
--
-- Four tables:
--
--   1. classes        — "Lớp học" (6A1, 7B2, 12A3, …)
--   2. subjects       — "Môn học" (Toán, Văn, Anh, …) with short code + color
--   3. periods        — "Khung tiết" (T1 = 07:00–07:45, …) split SÁNG / CHIỀU
--   4. timetable_slots — the actual placement: class × day × period →
--                       subject + teacher
--
-- Conflict constraints at the DB layer:
--   • A class can only hold one subject per (day, period).
--   • A teacher can only teach one class per (day, period) — enforced via
--     a partial unique index that skips NULL teacher_id (slots without an
--     assigned teacher don't conflict).
--
-- RLS: admin writes; any active tenant member reads (teachers need to
-- view their own assignments and students will eventually read theirs).
--
-- Depends on:
--   - 0002_init_tenant_auth.sql            (tenants)
--   - 0012_multi_teacher_calendar.sql      (tenant_teachers, helpers)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. classes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.classes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name                TEXT NOT NULL,           -- "6A1", "12 Toán 1"
    grade_level         SMALLINT NULL,           -- 6, 7, …, 12 (optional)
    year_label          TEXT NOT NULL DEFAULT '', -- "2025-2026" — free-form
    homeroom_teacher_id UUID NULL
        REFERENCES public.tenant_teachers(id) ON DELETE SET NULL,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT classes_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT classes_grade_range
        CHECK (grade_level IS NULL OR (grade_level BETWEEN 1 AND 12)),
    CONSTRAINT classes_unique_name_per_tenant
        UNIQUE (tenant_id, name, year_label)
);

CREATE INDEX IF NOT EXISTS idx_classes_tenant_active
    ON public.classes(tenant_id) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS on_classes_updated ON public.classes;
CREATE TRIGGER on_classes_updated
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. subjects
-- ────────────────────────────────────────────────────────────────────────────
-- short_code keeps the printable timetable compact ("T" for Toán). color
-- is hex (#RRGGBB) — matches the existing tenant_teachers.color convention.

CREATE TABLE IF NOT EXISTS public.subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name        TEXT NOT NULL,         -- "Toán"
    short_code  TEXT NOT NULL,         -- "T"
    color       TEXT NOT NULL DEFAULT '#6366F1',

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subjects_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT subjects_short_code_not_blank CHECK (length(btrim(short_code)) > 0),
    CONSTRAINT subjects_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT subjects_unique_name_per_tenant
        UNIQUE (tenant_id, name),
    CONSTRAINT subjects_unique_code_per_tenant
        UNIQUE (tenant_id, short_code)
);

DROP TRIGGER IF EXISTS on_subjects_updated ON public.subjects;
CREATE TRIGGER on_subjects_updated
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 3. periods (khung tiết)
-- ────────────────────────────────────────────────────────────────────────────
-- Two shifts (SÁNG = morning, CHIỀU = afternoon). Period number is 1-based
-- within shift. start_time / end_time are local clock times (no date),
-- stored as Postgres TIME — Asia/Ho_Chi_Minh by convention.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'period_shift'
    ) THEN
        CREATE TYPE public.period_shift AS ENUM ('SANG', 'CHIEU');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    shift           public.period_shift NOT NULL,
    period_number   SMALLINT NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT periods_number_positive CHECK (period_number BETWEEN 1 AND 20),
    CONSTRAINT periods_time_order CHECK (end_time > start_time),
    CONSTRAINT periods_unique_slot
        UNIQUE (tenant_id, shift, period_number)
);

CREATE INDEX IF NOT EXISTS idx_periods_tenant_order
    ON public.periods(tenant_id, shift, period_number);

DROP TRIGGER IF EXISTS on_periods_updated ON public.periods;
CREATE TRIGGER on_periods_updated
    BEFORE UPDATE ON public.periods
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. timetable_slots — the placement table
-- ────────────────────────────────────────────────────────────────────────────
-- One row = "class C at day D, period P → subject S taught by teacher T".
-- day_of_week follows ISO: 1 = Monday … 7 = Sunday.
--
-- Two key UNIQUEs:
--   • per-class slot uniqueness — a class can only do one subject per slot
--   • per-teacher slot uniqueness (partial, teacher_id IS NOT NULL) — a
--     teacher can't be in two rooms at once.
-- The partial form lets you DRAFT a class schedule without picking teachers
-- yet (NULL teacher_id → no conflict).

CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    class_id        UUID NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
    day_of_week     SMALLINT NOT NULL,
    period_id       UUID NOT NULL REFERENCES public.periods(id)  ON DELETE RESTRICT,

    subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    teacher_id      UUID NULL
        REFERENCES public.tenant_teachers(id) ON DELETE SET NULL,

    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT timetable_slots_dow_iso CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT timetable_slots_unique_class_slot
        UNIQUE (class_id, day_of_week, period_id)
);

-- Teacher conflict — partial unique on (teacher_id, day, period). Skips
-- NULL so unfilled slots don't trip the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_timetable_slots_teacher_no_conflict
    ON public.timetable_slots(teacher_id, day_of_week, period_id)
    WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_slots_tenant
    ON public.timetable_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_class
    ON public.timetable_slots(class_id, day_of_week, period_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_teacher_lookup
    ON public.timetable_slots(teacher_id, day_of_week)
    WHERE teacher_id IS NOT NULL;

DROP TRIGGER IF EXISTS on_timetable_slots_updated ON public.timetable_slots;
CREATE TRIGGER on_timetable_slots_updated
    BEFORE UPDATE ON public.timetable_slots
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
-- Pattern across all 4 tables:
--   READ  — any active tenant member (admin or teacher slot)
--   WRITE — tenant admin only

ALTER TABLE public.classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots  ENABLE ROW LEVEL SECURITY;

-- Helper to keep the policy SQL short.
-- Reads: admin OR has a slot at the tenant.
-- Writes: admin only.

DROP POLICY IF EXISTS "classes: member read"  ON public.classes;
DROP POLICY IF EXISTS "classes: admin write"  ON public.classes;
CREATE POLICY "classes: member read"
    ON public.classes FOR SELECT TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );
CREATE POLICY "classes: admin write"
    ON public.classes FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "subjects: member read" ON public.subjects;
DROP POLICY IF EXISTS "subjects: admin write" ON public.subjects;
CREATE POLICY "subjects: member read"
    ON public.subjects FOR SELECT TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );
CREATE POLICY "subjects: admin write"
    ON public.subjects FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "periods: member read" ON public.periods;
DROP POLICY IF EXISTS "periods: admin write" ON public.periods;
CREATE POLICY "periods: member read"
    ON public.periods FOR SELECT TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );
CREATE POLICY "periods: admin write"
    ON public.periods FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "timetable_slots: member read" ON public.timetable_slots;
DROP POLICY IF EXISTS "timetable_slots: admin write" ON public.timetable_slots;
CREATE POLICY "timetable_slots: member read"
    ON public.timetable_slots FOR SELECT TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
        OR public.current_tenant_teacher_id(tenant_id) IS NOT NULL
    );
CREATE POLICY "timetable_slots: admin write"
    ON public.timetable_slots FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));
