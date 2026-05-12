-- ============================================================================
-- VLearning — Payroll Module (PRD §5.8, §6)
-- ============================================================================
-- Migration: 0014_create_payroll.sql
--
-- Introduces the payroll domain — the killer feature. Period rows are
-- created monthly; item rows store the SNAPSHOT of the calculator output
-- at create-period time. Recomputing later (e.g. after an adjustment)
-- overwrites the item row but never the approved period — once approved,
-- numbers are frozen.
--
-- Why snapshots instead of live recomputation:
--   - Teachers change rates over time. An approved payroll must reflect
--     the rate at the time of approval, not "current rate".
--   - The audit_trail captured at calc time is what the admin signed off
--     on; later schema/code changes shouldn't retroactively alter it.
--
-- Depends on: 0013_create_centers.sql (centers, user_centers, is_center_admin).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE public.payroll_period_status AS ENUM ('DRAFT', 'APPROVED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. PAYROLL_PERIODS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    center_id       UUID        NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,

    status          public.payroll_period_status NOT NULL DEFAULT 'DRAFT',

    approved_by     UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,

    -- Free-form metadata (notes from the admin about this run).
    notes           TEXT        NOT NULL DEFAULT '',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payroll_periods_dates_ordered CHECK (period_end >= period_start),
    -- One period per (center, month) is enforced softly via UI; allow
    -- duplicates here so re-runs are possible for testing.
    CONSTRAINT payroll_periods_status_paid_needs_approved CHECK (
        (status <> 'PAID') OR (approved_at IS NOT NULL)
    )
);

COMMENT ON TABLE  public.payroll_periods IS 'Per-center monthly payroll runs. PRD §5.8.';
COMMENT ON COLUMN public.payroll_periods.status IS 'DRAFT → APPROVED → PAID. No going back.';

CREATE INDEX IF NOT EXISTS idx_payroll_periods_center_month
    ON public.payroll_periods(center_id, period_start DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. PAYROLL_ITEMS
-- ────────────────────────────────────────────────────────────────────────────
-- One row per teacher per period. `breakdown` + `audit_trail` are the
-- calculator output captured at creation time. `adjustments` is the
-- admin-managed list of manual bonuses/deductions; mutating it re-runs
-- the calculator (in the service layer) and overwrites `breakdown`,
-- `audit_trail`, `calculated_amount`, `final_amount`.
--
-- teacher_id has no FK because the `teachers` table doesn't exist yet
-- (Cycle 2 ambiguity). We snapshot the relevant teacher fields into
-- teacher_snapshot so payroll history doesn't decay when a teacher's
-- rate changes later.

CREATE TABLE IF NOT EXISTS public.payroll_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payroll_period_id   UUID        NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    teacher_id          UUID        NOT NULL,  -- references the eventual teachers.user_id

    -- Frozen copy of who/what was paid (name, rate, payment_structure, mst...).
    teacher_snapshot    JSONB       NOT NULL,

    -- PRD §6 fields. All money is integer VND.
    calculated_amount   BIGINT      NOT NULL DEFAULT 0,
    final_amount        BIGINT      NOT NULL DEFAULT 0,

    -- Manual adjustments (admin-entered). Array of
    --   { id, type: 'BONUS'|'DEDUCTION', amount, reason, created_at, created_by }
    -- Mutating triggers a recompute in the service layer.
    adjustments         JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- PayrollBreakdown from the calculator (hours_taught_minutes,
    -- sessions_paid, hourly_pay, per_session_pay, fixed_monthly_pay,
    -- bonuses, deductions, automatic_penalties, calculated_amount).
    breakdown           JSONB       NOT NULL DEFAULT '{}'::jsonb,

    -- AuditEntry[] from the calculator.
    audit_trail         JSONB       NOT NULL DEFAULT '[]'::jsonb,

    notes               TEXT        NOT NULL DEFAULT '',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT payroll_items_uq_period_teacher UNIQUE (payroll_period_id, teacher_id),
    CONSTRAINT payroll_items_amounts_non_negative CHECK (
        calculated_amount >= 0 AND final_amount >= 0
    )
);

COMMENT ON TABLE  public.payroll_items IS 'Per-teacher payroll row inside a period. PRD §5.8 + §6.';
COMMENT ON COLUMN public.payroll_items.teacher_snapshot IS 'Frozen teacher fields at calc time — rate, structure, MST, etc.';
COMMENT ON COLUMN public.payroll_items.breakdown IS 'PayrollBreakdown from calculator (read-only after approve).';
COMMENT ON COLUMN public.payroll_items.audit_trail IS 'AuditEntry[] from calculator (read-only after approve).';

CREATE INDEX IF NOT EXISTS idx_payroll_items_period
    ON public.payroll_items(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_teacher
    ON public.payroll_items(teacher_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS — auto-update updated_at
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER on_payroll_periods_updated
    BEFORE UPDATE ON public.payroll_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_payroll_items_updated
    BEFORE UPDATE ON public.payroll_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────
-- Use the helpers from 0013: is_center_member + is_center_admin.
-- Payroll is admin-only (CENTER_ADMIN); CENTER_STAFF / TEACHER do not
-- see payroll periods or items here. (Teachers seeing their OWN earnings
-- is a different surface — PRD §5.3 earnings history — and is not
-- exposed via these tables today.)

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_periods: admin read"
    ON public.payroll_periods
    FOR SELECT
    TO authenticated
    USING (public.is_center_admin(center_id));

CREATE POLICY "payroll_periods: admin insert"
    ON public.payroll_periods
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_center_admin(center_id));

CREATE POLICY "payroll_periods: admin update"
    ON public.payroll_periods
    FOR UPDATE
    TO authenticated
    USING (public.is_center_admin(center_id))
    WITH CHECK (public.is_center_admin(center_id));

-- No DELETE policy: approved/paid history must not be erasable.


ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Items inherit the period's center via FK; check the parent.
CREATE POLICY "payroll_items: admin read"
    ON public.payroll_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND public.is_center_admin(p.center_id)
        )
    );

CREATE POLICY "payroll_items: admin insert"
    ON public.payroll_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND p.status = 'DRAFT'
              AND public.is_center_admin(p.center_id)
        )
    );

-- Updates only allowed while parent period is DRAFT — APPROVED freezes
-- the item rows. (Status transition itself updates the PERIOD row, not
-- items, so this doesn't block approval.)
CREATE POLICY "payroll_items: admin update draft only"
    ON public.payroll_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND p.status = 'DRAFT'
              AND public.is_center_admin(p.center_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND p.status = 'DRAFT'
              AND public.is_center_admin(p.center_id)
        )
    );


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ payroll_periods + payroll_items
-- ✅ Status enum DRAFT→APPROVED→PAID with paid-needs-approved check
-- ✅ payroll_items.adjustments | breakdown | audit_trail as JSONB
-- ✅ teacher_snapshot defers the teachers-table FK to Cycle 2+
-- ✅ RLS: CENTER_ADMIN-only; updates blocked on items once period APPROVED
-- ✅ Indexes for center-month list + period + teacher lookups
-- ============================================================================
