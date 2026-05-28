-- ============================================================================
-- VLearning — Fix enum casts in payroll bridge triggers (0022 hotfix)
-- ============================================================================
-- Migration: 0024_payroll_bridge_enum_casts.sql
--
-- Symptom (when editing a teacher after 0022 applied):
--   ERROR: column "role_in_center" is of type center_role but expression
--   is of type text
--
-- Root cause: the trigger functions in 0022 insert string literals
-- ('CENTER_ADMIN', 'TEACHER', 'ACTIVE') into enum columns without explicit
-- casts. Postgres does NOT implicitly coerce text → enum, so the trigger
-- fails the moment a tenant_teachers row's profile_id / is_admin / is_active
-- changes (which the /dashboard/teachers edit dialog does routinely).
--
-- The initial backfill INSERT…SELECT in 0022 had explicit casts and ran
-- fine — only the trigger paths were broken.
--
-- Fix: rewrite both trigger functions with branch-level casts (`'X'::enum`
-- inside each CASE arm and on every literal). CREATE OR REPLACE makes
-- this idempotent — the triggers themselves don't need re-creating since
-- they still point at the same function names.
--
-- Depends on:
--   - 0013_create_centers.sql (center_role + center_member_status enums)
--   - 0022_payroll_bridge.sql  (functions being replaced)
-- ============================================================================

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

CREATE OR REPLACE FUNCTION public.bridge_tenant_teacher_to_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
