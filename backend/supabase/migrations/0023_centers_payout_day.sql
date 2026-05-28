-- ============================================================================
-- VLearning — Monthly payout day on centers
-- ============================================================================
-- Migration: 0023_centers_payout_day.sql
--
-- Adds a per-center "payroll payout day" (1-31). When the admin visits
-- /admin/payroll on or after this day each month, the previous month's
-- payroll period is auto-generated if it doesn't already exist.
--
-- Why a column (not centers.settings JSONB):
--   - Queryable: a future Edge function / pg_cron job that fans out across
--     all centers (true scheduled auto-gen) wants a WHERE-able field.
--   - Constrained: a CHECK rejects invalid days at the DB layer.
--
-- NULL = no schedule; admin creates each period manually. We don't enforce
-- a default — every existing center keeps the manual flow until the admin
-- opts in.
--
-- Depends on:
--   - 0013_create_centers.sql
-- ============================================================================

ALTER TABLE public.centers
    ADD COLUMN IF NOT EXISTS payroll_payout_day SMALLINT NULL
        CHECK (payroll_payout_day IS NULL OR (payroll_payout_day BETWEEN 1 AND 31));

COMMENT ON COLUMN public.centers.payroll_payout_day IS
    'Day of month (1-31) the previous month''s payroll is auto-generated. NULL = manual creation only. The actual fan-out runs lazily on /admin/payroll visit today; a scheduled job can read this column later for fully-automated generation.';
