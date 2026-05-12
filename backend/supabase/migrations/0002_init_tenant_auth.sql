-- ============================================================================
-- VLearning — Multi-tenant Auth & Marketplace Schema
-- ============================================================================
-- Migration: 0002_init_tenant_auth.sql
-- Description: Adds multi-tenant support (tenants table, profile tenant_id)
--              for the B2B SaaS EdTech white-label architecture.
--
-- Depends on: 00001_initial_schema.sql (profiles, user_role enum)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. TENANTS TABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Each teacher creates a "tenant" (their own branded school).
-- Students register under a specific tenant via subdomain routing.

CREATE TABLE IF NOT EXISTS public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership: the teacher who owns this tenant
    owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Branding
    name            TEXT        NOT NULL,                   -- School display name
    subdomain       CITEXT      NOT NULL UNIQUE,            -- URL slug (e.g., "thaynam")
    logo_url        TEXT        DEFAULT '',
    description     TEXT        DEFAULT '',

    -- Visibility
    is_public       BOOLEAN     NOT NULL DEFAULT TRUE,      -- Show in marketplace?

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT tenants_subdomain_format CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
    CONSTRAINT tenants_one_per_owner UNIQUE (owner_id)
);

COMMENT ON TABLE  public.tenants IS 'Teacher-owned schools (tenants) for multi-tenant white-label';
COMMENT ON COLUMN public.tenants.subdomain IS 'Unique subdomain slug — used for routing (e.g., thaynam.ticoclass.com)';
COMMENT ON COLUMN public.tenants.is_public IS 'Whether this teacher appears in the public marketplace directory';

-- Index for fast subdomain lookups
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id  ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_public    ON public.tenants(is_public) WHERE is_public = TRUE;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ALTER PROFILES: Add tenant_id
-- ────────────────────────────────────────────────────────────────────────────
-- Students are linked to the tenant (school) they registered under.
-- Teachers have tenant_id = NULL (they own the tenant via tenants.owner_id).

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.tenant_id
    IS 'For students: the tenant (school) they belong to. NULL for teachers.';

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. AUTO-UPDATE updated_at TRIGGER
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER on_tenants_updated
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY: TENANTS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Anyone can read public tenants (for marketplace directory)
CREATE POLICY "tenants: public read"
    ON public.tenants
    FOR SELECT
    TO anon, authenticated
    USING (is_public = TRUE);

-- Owners can always read their own tenant (even if not public)
CREATE POLICY "tenants: owner read own"
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- Only authenticated users can create a tenant (will be their school)
CREATE POLICY "tenants: owner insert"
    ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Owners can update their own tenant settings
CREATE POLICY "tenants: owner update"
    ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Owners can delete their own tenant
CREATE POLICY "tenants: owner delete"
    ON public.tenants
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ tenants table with subdomain routing support
-- ✅ profiles.tenant_id linking students to schools
-- ✅ 5 RLS policies on tenants (public read, owner CRUD)
-- ✅ Indexes for subdomain, owner_id, and is_public lookups
-- ✅ Auto-update trigger for updated_at
-- ============================================================================
