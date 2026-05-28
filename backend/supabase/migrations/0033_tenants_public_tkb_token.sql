-- 0033_tenants_public_tkb_token.sql
--
-- Public read-only TKB sharing. Each tenant gets a random UUID token used
-- in the URL `/tkb/[token]/[grade]/[shift]` so students/parents can view
-- the timetable without logging in. The token is essentially a long random
-- string — leaking it only exposes the (already-low-sensitivity) school
-- schedule, not any auth or PII data.
--
-- Token is auto-generated on tenant insert. Admin can rotate it later via
-- a server action that updates this column (kills old QR codes).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS public_tkb_token UUID
    NOT NULL DEFAULT gen_random_uuid();

-- Backfill any existing rows (should be no-op since DEFAULT covers them).
UPDATE public.tenants
SET public_tkb_token = gen_random_uuid()
WHERE public_tkb_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_public_tkb_token
    ON public.tenants(public_tkb_token);

COMMENT ON COLUMN public.tenants.public_tkb_token IS
  'Public token for read-only TKB viewing via /tkb/[token]/[grade]/[shift]. Rotateable by admin.';

-- ── RLS: public read-only access via token ──────────────────────────────
--
-- The public route uses the service role to read by token bypassing RLS,
-- so no policy change needed for tenants table. But subjects, classes,
-- periods, tenant_teachers, timetable_slots all need a "public via token"
-- read path. We do this by ALSO querying with the service role from the
-- public route handler — never expose write access publicly.
--
-- (No new RLS policies needed; the public page handler will use
--  createAdminClient() scoped to data matching the token's tenant_id.)
