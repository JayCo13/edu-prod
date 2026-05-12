-- ============================================================================
-- VLearning — Centers Module (PRD §5.2, §6)
-- ============================================================================
-- Migration: 0013_create_centers.sql
--
-- Introduces the `centers` domain (per PRD pivot to B2B education-center
-- SaaS): the customer org and its membership graph.
--
-- COEXISTS with the legacy `tenants` schema. This migration does NOT rename
-- or migrate `tenants` rows — that's Cycle 2. New center-scoped features
-- (teachers, students, classes, sessions, attendance, payroll) will reference
-- `centers.id` going forward; legacy live_sessions / tenant_teachers continue
-- to reference `tenants.id` until the rename cycle.
--
-- Depends on: 0002_init_tenant_auth.sql (handle_updated_at function).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────────────────────

-- Role a user holds within a specific center.
-- Platform-level SUPER_ADMIN lives elsewhere (profiles.role); a SUPER_ADMIN
-- bypass is not encoded here yet (TODO once that flow is designed).
DO $$ BEGIN
    CREATE TYPE public.center_role AS ENUM ('CENTER_ADMIN', 'CENTER_STAFF', 'TEACHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Membership status. INVITED = invitation pending (magic link not yet
-- accepted). INACTIVE = soft-removed (preserves history; PRD §5.3).
DO $$ BEGIN
    CREATE TYPE public.center_member_status AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Subscription plan tiers from PRD §1.3.
DO $$ BEGIN
    CREATE TYPE public.center_subscription_plan AS ENUM ('STARTER', 'GROWTH', 'PRO', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.center_subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. CENTERS TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.centers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name                    TEXT        NOT NULL,
    address                 TEXT        NOT NULL DEFAULT '',
    phone                   TEXT        NOT NULL DEFAULT '',
    logo_url                TEXT        NOT NULL DEFAULT '',

    -- Locale (PRD §5.2: timezone default Asia/Ho_Chi_Minh, currency VND locked for v1)
    timezone                TEXT        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    currency                TEXT        NOT NULL DEFAULT 'VND',

    -- Free-form per-center configuration (business_hours,
    -- default_class_duration, payroll_rules, etc.). Keeps the column count
    -- bounded as Phase-2+ features land.
    settings                JSONB       NOT NULL DEFAULT '{}'::jsonb,

    -- Billing
    subscription_plan       public.center_subscription_plan   NOT NULL DEFAULT 'STARTER',
    subscription_status     public.center_subscription_status NOT NULL DEFAULT 'TRIAL',

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Defensive constraints
    CONSTRAINT centers_name_not_blank       CHECK (length(btrim(name)) > 0),
    CONSTRAINT centers_currency_not_blank   CHECK (length(btrim(currency)) > 0)
);

COMMENT ON TABLE  public.centers IS 'Customer org (trung tâm). PRD §5.2.';
COMMENT ON COLUMN public.centers.settings IS 'JSONB bag for per-center config (business_hours, default_class_duration, payroll_rules).';
COMMENT ON COLUMN public.centers.currency IS 'Locked to VND for v1 (PRD §5.2). Schema kept flexible for future markets.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. USER_CENTERS TABLE (membership graph)
-- ────────────────────────────────────────────────────────────────────────────
-- One row per (user, center) pair. A user may belong to multiple centers
-- (PRD §2.2 — teachers commonly teach at several).

CREATE TABLE IF NOT EXISTS public.user_centers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    center_id           UUID        NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,

    role_in_center      public.center_role           NOT NULL,
    status              public.center_member_status  NOT NULL DEFAULT 'ACTIVE',

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A user has at most one membership row per center (their role can be
    -- changed in place; multiple roles aren't a use case in v1).
    CONSTRAINT user_centers_uq_user_center UNIQUE (user_id, center_id)
);

COMMENT ON TABLE  public.user_centers IS 'Many-to-many: which user has which role at which center. PRD §6.';

CREATE INDEX IF NOT EXISTS idx_user_centers_user_active
    ON public.user_centers(user_id)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_user_centers_center_active
    ON public.user_centers(center_id, role_in_center)
    WHERE status = 'ACTIVE';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS — auto-update updated_at
-- ────────────────────────────────────────────────────────────────────────────
-- handle_updated_at() is defined in 00001_initial_schema.sql.

CREATE OR REPLACE TRIGGER on_centers_updated
    BEFORE UPDATE ON public.centers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_user_centers_updated
    BEFORE UPDATE ON public.user_centers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTIONS (used by RLS policies)
-- ────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER means these run with table-owner privileges, NOT the
-- caller's. That lets RLS policies query user_centers without recursing into
-- user_centers' own RLS check (which would cause infinite recursion).

CREATE OR REPLACE FUNCTION public.is_center_member(target_center UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_centers
        WHERE user_id = auth.uid()
          AND center_id = target_center
          AND status = 'ACTIVE'
    );
$$;

COMMENT ON FUNCTION public.is_center_member(UUID)
    IS 'TRUE if the calling user has an ACTIVE membership at the given center. Used by RLS.';


CREATE OR REPLACE FUNCTION public.is_center_admin(target_center UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_centers
        WHERE user_id = auth.uid()
          AND center_id = target_center
          AND role_in_center = 'CENTER_ADMIN'
          AND status = 'ACTIVE'
    );
$$;

COMMENT ON FUNCTION public.is_center_admin(UUID)
    IS 'TRUE if the calling user is an ACTIVE CENTER_ADMIN at the given center.';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY — centers
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;

-- A user can SEE only centers they're an active member of.
-- (No "public" centers — no marketplace in this product per PRD §1.4.)
CREATE POLICY "centers: member read"
    ON public.centers
    FOR SELECT
    TO authenticated
    USING (public.is_center_member(id));

-- Any authenticated user can create a center. The service layer is
-- responsible for inserting a matching user_centers row with role
-- CENTER_ADMIN in the same transaction (otherwise the creator can never
-- read back the row they just inserted — by design).
CREATE POLICY "centers: authenticated insert"
    ON public.centers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only CENTER_ADMIN at this center can update its settings (PRD §5.2).
CREATE POLICY "centers: admin update"
    ON public.centers
    FOR UPDATE
    TO authenticated
    USING (public.is_center_admin(id))
    WITH CHECK (public.is_center_admin(id));

-- No delete via API in v1. (Subscriptions get cancelled, centers don't get
-- hard-deleted.) Omit the DELETE policy so it's denied by default.


-- ────────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY — user_centers
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_centers ENABLE ROW LEVEL SECURITY;

-- A user sees their own membership rows...
CREATE POLICY "user_centers: self read"
    ON public.user_centers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ...and CENTER_ADMINs see all membership rows at their center (for the
-- roster UI under PRD §5.3).
CREATE POLICY "user_centers: admin read center"
    ON public.user_centers
    FOR SELECT
    TO authenticated
    USING (public.is_center_admin(center_id));

-- Authenticated users may insert their OWN membership row. This permits the
-- "create center + add yourself as CENTER_ADMIN" flow to succeed without a
-- bootstrap function. CENTER_ADMINs also insert via a separate policy.
CREATE POLICY "user_centers: self insert"
    ON public.user_centers
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- CENTER_ADMINs add/remove members at their center (PRD §5.3 invite flow).
CREATE POLICY "user_centers: admin insert"
    ON public.user_centers
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_center_admin(center_id));

CREATE POLICY "user_centers: admin update"
    ON public.user_centers
    FOR UPDATE
    TO authenticated
    USING (public.is_center_admin(center_id))
    WITH CHECK (public.is_center_admin(center_id));

CREATE POLICY "user_centers: admin delete"
    ON public.user_centers
    FOR DELETE
    TO authenticated
    USING (public.is_center_admin(center_id));


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ centers table (PRD §6) — settings JSONB + subscription + locale defaults
-- ✅ user_centers many-to-many with role_in_center + status enums
-- ✅ Helper SECURITY DEFINER functions: is_center_member, is_center_admin
-- ✅ RLS: "users see only centers they belong to"; CENTER_ADMIN updates
-- ✅ RLS: user_centers self-read, admin-read-center, admin-manage
-- ✅ Indexes on user_centers for active-membership lookups
-- ✅ updated_at triggers
-- ============================================================================
