-- ============================================================================
-- VLearning — Tenant profile_layout column
-- ============================================================================
-- Migration: 0010_tenants_profile_layout.sql
-- Description: Stores the teacher's authored profile-page composition as a
--              JSONB document. Validated by Zod (ProfileLayoutSchema) on the
--              app side; the DB just guards the shape.
-- ============================================================================

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS profile_layout JSONB;

COMMENT ON COLUMN public.tenants.profile_layout IS
    'Teacher-authored profile page composition. Shape: { accent: AccentId, modules: Module[] }. See frontend/src/lib/profile-schema.ts.';

-- Optional shape sanity-check: top-level must have an "accent" string and a
-- "modules" array if non-null. App-side Zod is the source of truth; this is a
-- cheap last-resort guard against blatantly wrong writes.
ALTER TABLE public.tenants
    DROP CONSTRAINT IF EXISTS tenants_profile_layout_shape;

ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_profile_layout_shape CHECK (
        profile_layout IS NULL
        OR (
            profile_layout ? 'accent'
            AND profile_layout ? 'modules'
            AND jsonb_typeof(profile_layout->'modules') = 'array'
        )
    );

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Existing tenants policies cover this column for free:
--   • SELECT: anyone (public marketplace) sees tenants where is_public = true
--   • SELECT (subdomain): existing 0009 policy allows read by subdomain
--   • UPDATE: only the owner (already enforced by tenants_owner_update policy)
-- No new policies needed for profile_layout.
