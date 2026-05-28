-- ============================================================================
-- VLearning — Payroll bridge: tenants → centers + teacher rate fields
-- ============================================================================
-- Migration: 0022_payroll_bridge.sql
--
-- Two things ride together because they unblock the same flow ("admin pays
-- salary"):
--
-- 1. **Centers/user_centers backfill.** The payroll module (modules/payroll
--    + /admin/payroll route) is built against `centers` + `user_centers`
--    (migration 0013) and gates every action through `resolveCenterId` —
--    but nothing actually populates those tables today. Result: every
--    payroll action returns NO_CENTER. We mirror existing `tenants` into
--    `centers` using the SAME UUID (so we can swap storage cleanly later)
--    and project tenant ownership + tenant_teachers membership into
--    `user_centers`. This is the start of the rename in CLAUDE.md §5.
--
-- 2. **Rate columns on tenant_teachers.** The payroll calculator needs each
--    teacher's `payment_structure` + rate(s) + optional MST (tax_id). They
--    live on tenant_teachers so admins can configure them from the existing
--    /dashboard/teachers UI without a new table.
--
-- Idempotent (ON CONFLICT DO NOTHING, IF NOT EXISTS) so running this
-- multiple times is safe.
--
-- Depends on:
--   - 0002_init_tenant_auth.sql      (tenants)
--   - 0012_multi_teacher_calendar.sql (tenant_teachers)
--   - 0013_create_centers.sql        (centers, user_centers, enums)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. BACKFILL public.centers from public.tenants (same UUID)
-- ────────────────────────────────────────────────────────────────────────────
-- Mirroring the UUID means any future `tenant_id` → `center_id` rename is a
-- one-line column rename; no UUID remapping needed. Currency defaults to
-- VND (PRD §5.2). `tenants` has no address/phone, so those stay default.

INSERT INTO public.centers (id, name, logo_url, created_at, updated_at)
SELECT
    t.id,
    t.name,
    COALESCE(t.logo_url, '') AS logo_url,
    t.created_at,
    t.updated_at
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.centers c WHERE c.id = t.id
);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL public.user_centers from tenant ownership + tenant_teachers
-- ────────────────────────────────────────────────────────────────────────────
-- Two sources, both projected to (user_id, center_id):
--   a) tenants.owner_id — always CENTER_ADMIN.
--   b) tenant_teachers (with profile_id NOT NULL, is_active = TRUE) —
--      CENTER_ADMIN if is_admin, else TEACHER.
--
-- The UNION + ON CONFLICT DO NOTHING handles the overlap: a tenant owner
-- usually has a tenant_teachers row (backfilled by 0012) and we keep the
-- ADMIN role from path (a) when both fire.

INSERT INTO public.user_centers (user_id, center_id, role_in_center, status)
SELECT t.owner_id, t.id, 'CENTER_ADMIN'::public.center_role, 'ACTIVE'::public.center_member_status
FROM public.tenants t
WHERE t.owner_id IS NOT NULL
ON CONFLICT (user_id, center_id) DO NOTHING;

INSERT INTO public.user_centers (user_id, center_id, role_in_center, status)
SELECT
    tt.profile_id,
    tt.tenant_id,
    CASE WHEN tt.is_admin THEN 'CENTER_ADMIN' ELSE 'TEACHER' END::public.center_role,
    'ACTIVE'::public.center_member_status
FROM public.tenant_teachers tt
WHERE tt.profile_id IS NOT NULL
  AND tt.is_active = TRUE
ON CONFLICT (user_id, center_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER — auto-create a `centers` row when a new tenant is inserted
-- ────────────────────────────────────────────────────────────────────────────
-- Without this, every brand-new tenant would re-introduce the same NO_CENTER
-- bug. The trigger also seeds a CENTER_ADMIN user_centers row for the owner
-- so payroll works immediately for new signups.

CREATE OR REPLACE FUNCTION public.bridge_tenant_to_center()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.centers (id, name, logo_url, created_at, updated_at)
    VALUES (NEW.id, NEW.name, COALESCE(NEW.logo_url, ''), NEW.created_at, NEW.updated_at)
    ON CONFLICT (id) DO NOTHING;

    -- Explicit enum casts: Postgres won't implicitly coerce text literals
    -- into role_in_center / status, even inside a trigger VALUES clause.
    IF NEW.owner_id IS NOT NULL THEN
        INSERT INTO public.user_centers (user_id, center_id, role_in_center, status)
        VALUES (
            NEW.owner_id,
            NEW.id,
            'CENTER_ADMIN'::public.center_role,
            'ACTIVE'::public.center_member_status
        )
        ON CONFLICT (user_id, center_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_inserted_bridge_to_center ON public.tenants;
CREATE TRIGGER on_tenant_inserted_bridge_to_center
    AFTER INSERT ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.bridge_tenant_to_center();

-- Mirror tenant_teachers inserts into user_centers as well, so admins
-- adding a teacher in /dashboard/teachers immediately gives that teacher
-- a TEACHER role row at the center.
CREATE OR REPLACE FUNCTION public.bridge_tenant_teacher_to_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only when we have a real user to bind. profile_id is filled either at
    -- insert time (admin pre-creates auth user) or by migration 0018's
    -- trigger when the teacher accepts their invite.
    --
    -- Branch-level enum casts: putting the cast inside each CASE arm is
    -- more bulletproof than casting the CASE result, because Postgres
    -- otherwise infers TEXT from the string literals and refuses to
    -- coerce into the role_in_center enum at INSERT time.
    IF NEW.profile_id IS NOT NULL AND NEW.is_active = TRUE THEN
        INSERT INTO public.user_centers (user_id, center_id, role_in_center, status)
        VALUES (
            NEW.profile_id,
            NEW.tenant_id,
            CASE
                WHEN NEW.is_admin THEN 'CENTER_ADMIN'::public.center_role
                ELSE 'TEACHER'::public.center_role
            END,
            'ACTIVE'::public.center_member_status
        )
        ON CONFLICT (user_id, center_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_teacher_inserted_bridge ON public.tenant_teachers;
CREATE TRIGGER on_tenant_teacher_inserted_bridge
    AFTER INSERT OR UPDATE OF profile_id, is_admin, is_active
    ON public.tenant_teachers
    FOR EACH ROW EXECUTE FUNCTION public.bridge_tenant_teacher_to_membership();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. tenant_teachers — payment rate columns
-- ────────────────────────────────────────────────────────────────────────────
-- BIGINT for money (đồng / VND integers — CLAUDE.md §8.1: never floats).
-- payment_structure mirrors the calculator's enum (modules/payroll/types.ts).
-- Default 'HOURLY' + 0đ so the column is safe to add to existing rows; admin
-- fills in the real rate from /dashboard/teachers later.

ALTER TABLE public.tenant_teachers
    ADD COLUMN IF NOT EXISTS payment_structure TEXT NOT NULL DEFAULT 'HOURLY'
        CHECK (payment_structure IN ('HOURLY', 'PER_SESSION', 'FIXED_MONTHLY', 'HYBRID')),
    ADD COLUMN IF NOT EXISTS hourly_rate BIGINT NOT NULL DEFAULT 0
        CHECK (hourly_rate >= 0),
    ADD COLUMN IF NOT EXISTS per_session_rate BIGINT NULL
        CHECK (per_session_rate IS NULL OR per_session_rate >= 0),
    ADD COLUMN IF NOT EXISTS fixed_monthly_amount BIGINT NULL
        CHECK (fixed_monthly_amount IS NULL OR fixed_monthly_amount >= 0),
    ADD COLUMN IF NOT EXISTS tax_id TEXT NULL;

COMMENT ON COLUMN public.tenant_teachers.payment_structure IS
    'Calculator-facing payment shape: HOURLY = paid per minute taught; PER_SESSION = flat per completed session; FIXED_MONTHLY = lump sum; HYBRID = monthly base + variable. Mirrors modules/payroll/types.ts PaymentStructure.';
COMMENT ON COLUMN public.tenant_teachers.hourly_rate IS
    'VND per hour, integer đồng. Used by HOURLY + HYBRID.';
COMMENT ON COLUMN public.tenant_teachers.per_session_rate IS
    'VND per completed session, integer đồng. Used by PER_SESSION + HYBRID.';
COMMENT ON COLUMN public.tenant_teachers.fixed_monthly_amount IS
    'VND per month, integer đồng. Used by FIXED_MONTHLY + HYBRID base.';
COMMENT ON COLUMN public.tenant_teachers.tax_id IS
    'Vietnamese Mã số thuế (MST). Shown in Excel payroll export; empty falls back to "-".';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TRIGGER on_tenant_inserted_bridge_to_center ON public.tenants;
-- DROP TRIGGER on_tenant_teacher_inserted_bridge ON public.tenant_teachers;
-- DROP FUNCTION public.bridge_tenant_to_center();
-- DROP FUNCTION public.bridge_tenant_teacher_to_membership();
-- ALTER TABLE public.tenant_teachers
--     DROP COLUMN IF EXISTS payment_structure,
--     DROP COLUMN IF EXISTS hourly_rate,
--     DROP COLUMN IF EXISTS per_session_rate,
--     DROP COLUMN IF EXISTS fixed_monthly_amount,
--     DROP COLUMN IF EXISTS tax_id;
-- (centers + user_centers backfill is data — leave it.)
-- ============================================================================
