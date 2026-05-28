-- ============================================================================
-- VLearning — Allow admins to UPDATE the paid_* columns on APPROVED items
-- ============================================================================
-- Migration: 0027_payroll_items_update_paid_columns.sql
--
-- Symptom: admin clicks "Thanh toán" on an APPROVED period. The action
-- thinks it succeeded (no error, email fires), but the row still shows
-- as unpaid. The `Thanh toán` button stays clickable and a second click
-- sends another email.
--
-- Root cause: migration 0014 created the policy
--   "payroll_items: admin update draft only"
-- which gates ALL updates on `period.status = 'DRAFT'`. That made sense
-- when the only "update" was bonus/deduction edits (PRD §11 audit).
-- Migration 0026 introduced per-item mark-paid which writes paid_at /
-- payment_method / paid_by / paid_note AFTER approval — the policy
-- silently refuses, no rows updated, no error raised because Supabase
-- treats "0 rows matched by USING" as a benign no-op for UPDATE.
--
-- Fix: a SECOND policy that allows the admin to flip mark-paid columns
-- when the period is APPROVED (or PAID — the maybeFlipPeriodToPaid
-- helper bumps the period when the last item gets marked). The original
-- DRAFT policy is kept untouched so other column edits still respect it.
--
-- Postgres OR-combines RLS policies of the same action, so this widens
-- the write surface for paid-columns-on-APPROVED only.
--
-- Depends on:
--   - 0014_create_payroll.sql    (existing DRAFT-only policy)
--   - 0026_payout_workflow.sql   (paid_at / payment_method / paid_by / paid_note)
-- ============================================================================

DROP POLICY IF EXISTS "payroll_items: admin update mark paid"
    ON public.payroll_items;

CREATE POLICY "payroll_items: admin update mark paid"
    ON public.payroll_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND p.status IN ('APPROVED', 'PAID')
              AND public.is_center_admin(p.center_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.payroll_periods p
            WHERE p.id = payroll_items.payroll_period_id
              AND p.status IN ('APPROVED', 'PAID')
              AND public.is_center_admin(p.center_id)
        )
    );

COMMENT ON POLICY "payroll_items: admin update mark paid"
    ON public.payroll_items IS
    'Pairs with the DRAFT-only update policy from 0014. Allows center admins to write paid_at / payment_method / paid_by / paid_note on APPROVED (or PAID) items. The action layer enforces field-level discipline — Postgres doesn''t support column-level RLS, but the server actions only ever SET those four columns at this stage.';
