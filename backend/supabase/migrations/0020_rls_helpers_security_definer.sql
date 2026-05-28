-- ============================================================================
-- VLearning — Make RLS helpers SECURITY DEFINER (fix teacher self-read)
-- ============================================================================
-- Migration: 0020_rls_helpers_security_definer.sql
--
-- Symptom: a non-admin teacher signing in is redirected to /onboarding even
-- though their tenant_teachers row exists with the correct profile_id. The
-- `tenants.owner_id = auth.uid()` lookup returns nothing (they're not an
-- owner), and the follow-up `tenant_teachers WHERE profile_id = auth.uid()`
-- returns nothing either — because the RLS read policy recursively calls
-- public.current_tenant_teacher_id(tenant_id), which itself selects from
-- tenant_teachers and re-enters the same policy. The recursion never
-- finds a row for a non-admin (admins short-circuit via the
-- `tenants.owner_id` branch of is_tenant_admin).
--
-- Fix: mark both helpers SECURITY DEFINER so their inner queries run with
-- the function owner's privileges and bypass row-level security. The
-- functions are tiny, parameterised, and don't expose any data beyond what
-- the calling policy already implies — they're safe to elevate.
--
-- Depends on:
--   - 0012_multi_teacher_calendar.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenants
        WHERE id = p_tenant_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.tenant_teachers
        WHERE tenant_id = p_tenant_id
          AND profile_id = auth.uid()
          AND is_admin = TRUE
          AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_teacher_id(p_tenant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.tenant_teachers
    WHERE tenant_id = p_tenant_id
      AND profile_id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;

-- SECURITY DEFINER + the function owner being postgres / supabase_admin
-- means callers don't need direct SELECT on tenant_teachers to evaluate
-- these. Restrict EXECUTE so only authenticated users (and service role)
-- can invoke them — anon shouldn't probe tenancy.
REVOKE ALL ON FUNCTION public.is_tenant_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_tenant_teacher_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_teacher_id(UUID) TO authenticated, service_role;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Re-run the function definitions from 0012 without SECURITY DEFINER. The
-- system will revert to the recursive policy evaluation that breaks
-- non-admin reads.
-- ============================================================================
