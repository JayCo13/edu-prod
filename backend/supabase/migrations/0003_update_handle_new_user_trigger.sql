-- ============================================================================
-- VLearning — Update handle_new_user Trigger for Multi-tenant
-- ============================================================================
-- Migration: 0003_update_handle_new_user_trigger.sql
-- Description: Updates the handle_new_user() trigger to read role and
--              tenant_id directly from raw_user_meta_data.
--
-- WHY: The previous approach used a setTimeout(500ms) + separate UPDATE
--      in the Server Action, which was a race condition anti-pattern.
--      Now the trigger handles everything atomically in one INSERT.
--
-- Depends on:
--   - 00001_initial_schema.sql (profiles table, user_role enum)
--   - 0002_init_tenant_auth.sql (tenant_id column on profiles)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. REPLACE THE TRIGGER FUNCTION
-- ────────────────────────────────────────────────────────────────────────────
-- Reads from raw_user_meta_data:
--   display_name → profiles.display_name
--   avatar_url   → profiles.avatar_url
--   role         → profiles.role (defaults to 'student' if not provided)
--   tenant_id    → profiles.tenant_id (NULL if empty or not provided)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _role       public.user_role;
    _tenant_id  UUID;
BEGIN
    -- Parse role from metadata, default to 'student'
    BEGIN
        _role := COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'role', ''),
            'student'
        )::public.user_role;
    EXCEPTION
        WHEN invalid_text_representation THEN
            _role := 'student';
    END;

    -- Parse tenant_id from metadata (UUID or NULL)
    BEGIN
        _tenant_id := NULLIF(NEW.raw_user_meta_data ->> 'tenant_id', '')::UUID;
    EXCEPTION
        WHEN invalid_text_representation THEN
            _tenant_id := NULL;
    END;

    -- Single atomic INSERT — no separate UPDATE needed
    INSERT INTO public.profiles (id, display_name, avatar_url, role, tenant_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        NEW.raw_user_meta_data ->> 'avatar_url',
        _role,
        _tenant_id
    );

    RETURN NEW;
END;
$$;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ handle_new_user() now reads role and tenant_id from user_metadata
-- ✅ Defaults: role = 'student', tenant_id = NULL
-- ✅ Exception handling for invalid enum/UUID values
-- ✅ Single atomic INSERT — no race conditions
-- ============================================================================
