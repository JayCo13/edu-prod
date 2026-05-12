-- ============================================================================
-- VLearning — Allow subdomain access to tenants
-- ============================================================================
-- Migration: 0009_tenants_public_by_subdomain.sql
--
-- The existing RLS policy "tenants: public read" only allows reading tenants
-- with is_public = TRUE. However, subdomain-routed pages (e.g., /t/[slug])
-- need to read ANY tenant by its subdomain — if a teacher has a subdomain,
-- their profile should be accessible.
--
-- This adds a new policy that allows everyone (anon + authenticated)
-- to read any tenant. The is_public flag is now handled at the
-- application layer for marketplace directory listing.
-- ============================================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "tenants: public read" ON public.tenants;

-- Replace with an open read policy
-- (Marketplace directory filtering by is_public is done in application code)
CREATE POLICY "tenants: anyone can read"
    ON public.tenants
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ Replaced "tenants: public read" (is_public = TRUE filter)
--    with "tenants: anyone can read" (no filter).
-- ✅ Marketplace directory still filters by is_public in the server action.
-- ✅ Subdomain pages can now always resolve a tenant.
-- ============================================================================
