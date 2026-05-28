-- ============================================================================
-- VLearning — Storage RLS for `public_assets` bucket
-- ============================================================================
-- Migration: 0028_public_assets_storage_rls.sql
--
-- The `public_assets` bucket already exists (created via Dashboard when the
-- project was bootstrapped) and is public-readable. We need INSERT/UPDATE
-- policies so authenticated users can upload to scoped subfolders:
--
--   avatars/<auth.uid()>/<file>            — anyone uploads to their own
--   center-logos/<tenant_id>/<file>        — only the tenant owner / admin
--
-- This is idempotent (DROP IF EXISTS + CREATE), safe to re-run.
--
-- Depends on:
--   - 0013_create_centers.sql / 0022_payroll_bridge.sql for is_tenant_admin
-- ============================================================================

DROP POLICY IF EXISTS "public_assets: avatar owner write" ON storage.objects;
DROP POLICY IF EXISTS "public_assets: center logo admin write" ON storage.objects;
DROP POLICY IF EXISTS "public_assets: public read" ON storage.objects;

-- Public read for everything in this bucket (it's already public-readable
-- via the bucket setting, but an explicit RLS policy makes the access path
-- consistent across self-hosted / managed Supabase variations).
CREATE POLICY "public_assets: public read"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'public_assets');

-- avatars/<uid>/<file> — caller owns their folder.
CREATE POLICY "public_assets: avatar owner write"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'public_assets'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'public_assets'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- center-logos/<tenant_id>/<file> — tenant admins of that tenant only.
CREATE POLICY "public_assets: center logo admin write"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'public_assets'
        AND (storage.foldername(name))[1] = 'center-logos'
        AND public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
    )
    WITH CHECK (
        bucket_id = 'public_assets'
        AND (storage.foldername(name))[1] = 'center-logos'
        AND public.is_tenant_admin(((storage.foldername(name))[2])::uuid)
    );
