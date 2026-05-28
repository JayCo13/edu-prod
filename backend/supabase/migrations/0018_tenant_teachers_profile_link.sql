-- ============================================================================
-- VLearning — Auto-link tenant_teachers.profile_id on auth.users insert
-- ============================================================================
-- Migration: 0018_tenant_teachers_profile_link.sql
--
-- When a teacher accepts an invite and finishes the password-setup flow,
-- Supabase creates a row in auth.users. This trigger looks for any
-- tenant_teachers row that the admin pre-created with the same email and
-- fills its profile_id. Without this, every newly-onboarded teacher would
-- need a manual link step.
--
-- The match is case-insensitive on email. Multiple unlinked rows with the
-- same email (e.g., a teacher invited to two centers before signing up)
-- all get linked in one statement.
--
-- This is an ADDITIVE trigger — it runs alongside the existing
-- handle_new_user() trigger and does not modify it.
--
-- Depends on:
--   - 0012_multi_teacher_calendar.sql (tenant_teachers table)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. TRIGGER FUNCTION
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_tenant_teacher_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.tenant_teachers
       SET profile_id = NEW.id,
           updated_at = NOW()
     WHERE profile_id IS NULL
       AND email IS NOT NULL
       AND lower(email) = lower(NEW.email);
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_tenant_teacher_to_profile() IS
    'Fires after a new auth.users row is inserted. Links any tenant_teachers slots that were pre-created by an admin with the same email (case-insensitive), filling profile_id atomically.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER (AFTER INSERT on auth.users)
-- ────────────────────────────────────────────────────────────────────────────
-- Drop-if-exists for idempotency. The name is suffixed with `_link_teacher`
-- so it sorts AFTER Supabase's default `on_auth_user_created` trigger that
-- runs handle_new_user() — handle_new_user creates the profile row, and
-- this trigger then references the new user id.

DROP TRIGGER IF EXISTS on_auth_user_created_link_teacher ON auth.users;

CREATE TRIGGER on_auth_user_created_link_teacher
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.link_tenant_teacher_to_profile();
