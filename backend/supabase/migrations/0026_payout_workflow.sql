-- ============================================================================
-- VLearning — Manual payout workflow
-- ============================================================================
-- Migration: 0026_payout_workflow.sql
--
-- Adds the manual-payout primitives that close the salary loop:
--
--   1. `teacher_payout_methods` — bank info each teacher provides so the
--      admin knows where to transfer. Storage of account numbersis
--      sensitive, hence tight RLS: a teacher reads/writes only their own
--      rows; the tenant admin can READ (to display + transfer) but can
--      never WRITE someone else's banking info.
--
--   2. Storage bucket `payout-qr` — private bucket for the VietQR /
--      bank-app QR images teachers upload. Path is keyed by the user's
--      auth.uid() so the storage RLS is trivial: each user owns their
--      folder; tenant admins of the same tenant can read it.
--
--   3. `payroll_items` payment columns — `payment_method`, `paid_at`,
--      `paid_by`, `paid_note`. The period.status flow stays the same
--      (DRAFT → APPROVED → PAID) but PAID now means "the admin marked
--      every item as paid", not just "admin clicked one button".
--
-- Depends on:
--   - 0012_multi_teacher_calendar.sql  (tenant_teachers)
--   - 0014_create_payroll.sql           (payroll_items)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. teacher_payout_methods
-- ────────────────────────────────────────────────────────────────────────────
-- A teacher may register multiple banks (rare in VN but allowed). One is
-- flagged is_primary = TRUE — the one the admin defaults to on payment.
-- Enforced by a partial unique index so at most one primary per teacher.

CREATE TABLE IF NOT EXISTS public.teacher_payout_methods (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    teacher_id       UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,

    bank_name        TEXT NOT NULL,
    account_number   TEXT NOT NULL,
    account_holder   TEXT NOT NULL,

    -- Storage path inside the `payout-qr` bucket (e.g. "<auth.uid()>/<file>").
    -- NULL when the teacher hasn't uploaded a QR yet — admin types account
    -- number manually into their bank app in that case.
    qr_image_path    TEXT NULL,

    is_primary       BOOLEAN NOT NULL DEFAULT TRUE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Light defensive constraints; UI does most of the validation.
    CONSTRAINT teacher_payout_bank_not_blank      CHECK (length(btrim(bank_name))      > 0),
    CONSTRAINT teacher_payout_account_not_blank   CHECK (length(btrim(account_number)) > 0),
    CONSTRAINT teacher_payout_holder_not_blank    CHECK (length(btrim(account_holder)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_teacher_payout_methods_teacher
    ON public.teacher_payout_methods(teacher_id);

-- At most one primary per teacher (admins read this first).
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_payout_methods_primary
    ON public.teacher_payout_methods(teacher_id)
    WHERE is_primary = TRUE AND is_active = TRUE;

-- updated_at trigger reuses the project-wide handle_updated_at() (00001).
DROP TRIGGER IF EXISTS on_teacher_payout_methods_updated ON public.teacher_payout_methods;
CREATE TRIGGER on_teacher_payout_methods_updated
    BEFORE UPDATE ON public.teacher_payout_methods
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS — teacher_payout_methods
-- ────────────────────────────────────────────────────────────────────────────
-- Teacher sees + edits THEIR OWN rows (matched by tenant_teachers.profile_id).
-- Tenant admin (owner OR is_admin slot) can READ any row in their tenant
-- so the payout UI can show account info — but admin cannot WRITE banking
-- info on someone else's behalf (separation of duties for security).

ALTER TABLE public.teacher_payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_methods: teacher rw own" ON public.teacher_payout_methods;
DROP POLICY IF EXISTS "payout_methods: tenant admin read" ON public.teacher_payout_methods;

CREATE POLICY "payout_methods: teacher rw own"
    ON public.teacher_payout_methods
    FOR ALL
    TO authenticated
    USING (
        teacher_id IN (
            SELECT id FROM public.tenant_teachers
            WHERE profile_id = auth.uid()
              AND is_active = TRUE
        )
    )
    WITH CHECK (
        teacher_id IN (
            SELECT id FROM public.tenant_teachers
            WHERE profile_id = auth.uid()
              AND is_active = TRUE
        )
    );

CREATE POLICY "payout_methods: tenant admin read"
    ON public.teacher_payout_methods
    FOR SELECT
    TO authenticated
    USING (
        public.is_tenant_admin(tenant_id)
    );


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket `payout-qr`
-- ────────────────────────────────────────────────────────────────────────────
-- Private bucket. Path convention: "<auth.uid()>/<uuid>.<ext>". Storage
-- RLS just compares the first folder segment against auth.uid() — a teacher
-- owns their folder; a tenant admin of the same tenant can read it via the
-- secondary policy.
--
-- If your project disallows running SQL against the `storage` schema, run
-- the bucket creation through the Dashboard Storage UI instead and only
-- apply sections 1, 2, 4 here.

INSERT INTO storage.buckets (id, name, public)
VALUES ('payout-qr', 'payout-qr', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payout-qr: owner full access" ON storage.objects;
DROP POLICY IF EXISTS "payout-qr: tenant admin read" ON storage.objects;

-- Owner of the folder (teacher) reads + writes their own objects.
CREATE POLICY "payout-qr: owner full access"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'payout-qr'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'payout-qr'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Tenant admins of the SAME tenant as the file's owner can read.
-- The folder segment is the uploader's auth.uid; we cross-walk that to
-- tenant_teachers → tenant and check is_tenant_admin().
CREATE POLICY "payout-qr: tenant admin read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payout-qr'
        AND EXISTS (
            SELECT 1
            FROM public.tenant_teachers tt
            WHERE tt.profile_id::text = (storage.foldername(name))[1]
              AND public.is_tenant_admin(tt.tenant_id)
        )
    );


-- ────────────────────────────────────────────────────────────────────────────
-- 4. payroll_items — per-item payment columns
-- ────────────────────────────────────────────────────────────────────────────
-- The admin marks each teacher's item paid individually. payment_method
-- captures whether the actual transfer was BANK_TRANSFER or CASH (drives
-- email template choice + audit). paid_at + paid_by are the receipt.

ALTER TABLE public.payroll_items
    ADD COLUMN IF NOT EXISTS payment_method TEXT NULL
        CHECK (payment_method IS NULL OR payment_method IN ('BANK_TRANSFER', 'CASH')),
    ADD COLUMN IF NOT EXISTS paid_at        TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS paid_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS paid_note      TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_payroll_items_paid
    ON public.payroll_items(payroll_period_id, paid_at);

COMMENT ON COLUMN public.payroll_items.payment_method IS
    'BANK_TRANSFER (chuyển khoản) or CASH (tiền mặt). NULL until the admin marks paid. Drives the email template sent to the teacher.';
COMMENT ON COLUMN public.payroll_items.paid_at IS
    'Set when the admin clicks "Đã thanh toán" for this teacher. Period.status flips to PAID when every item has paid_at.';
COMMENT ON COLUMN public.payroll_items.paid_by IS
    'auth.users.id of the admin who marked it paid. Audit trail for reconciliation.';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- ALTER TABLE public.payroll_items
--     DROP COLUMN IF EXISTS payment_method,
--     DROP COLUMN IF EXISTS paid_at,
--     DROP COLUMN IF EXISTS paid_by,
--     DROP COLUMN IF EXISTS paid_note;
-- DROP POLICY ... ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'payout-qr';
-- DROP TABLE public.teacher_payout_methods;
-- ============================================================================
