-- ============================================================================
-- VLearning — Audit Logs (PRD §11 acceptance — "who changed what, when")
-- ============================================================================
-- Migration: 0015_create_audit_logs.sql
--
-- Tamper-resistant log of mutations to high-value entities (payroll
-- adjustments, period approvals, mark-paid). Cycle 7 wires only the
-- payroll module; other modules (attendance corrections, tuition
-- invoices, etc.) will write their own entries with the same shape.
--
-- Logging strategy: APPLICATION-LEVEL writes from service.ts inside a
-- best-effort transaction with the underlying mutation. SQL TRIGGER
-- objects were considered but rejected because the context we want to
-- capture (reason, IP, user-agent, denormalized names) doesn't exist
-- in the SQL layer.
--
-- Multi-tenant: PRD §11 acceptance — "No cross-center data leaks". RLS
-- below filters by center_id; the service layer also resolves
-- center_id explicitly so the FK + RLS check happen together.
--
-- Depends on: 0013_create_centers.sql (is_center_admin helper).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-tenant scope. NOT NULL: every audit event belongs to a center.
    center_id       UUID        NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,

    -- Who did it. Nullable for system-driven events (cron, migrations).
    user_id         UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,

    -- What happened. Dotted lowercase keys, e.g.
    --   payroll.adjustment.add
    --   payroll.adjustment.remove
    --   payroll.period.approve
    --   payroll.period.mark_paid
    action          TEXT        NOT NULL,

    -- Entity reference. entity_id may be the period id, item id, etc.
    entity_type     TEXT        NOT NULL,
    entity_id       UUID,

    -- Snapshot of the affected row(s) before and after the mutation.
    -- Either can be null (insert → no before; delete → no after).
    before          JSONB,
    after           JSONB,

    -- Free-form metadata. Conventions used today:
    --   { reason, actor_name, target_name, ip, user_agent, ... }
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_action_not_blank CHECK (length(btrim(action)) > 0),
    CONSTRAINT audit_logs_entity_type_not_blank CHECK (length(btrim(entity_type)) > 0)
);

COMMENT ON TABLE  public.audit_logs IS 'Tamper-resistant audit trail. PRD §11.';
COMMENT ON COLUMN public.audit_logs.action IS 'Dotted lowercase, e.g. payroll.adjustment.add.';
COMMENT ON COLUMN public.audit_logs.before IS 'Snapshot prior to mutation (null for inserts).';
COMMENT ON COLUMN public.audit_logs.after IS 'Snapshot post-mutation (null for deletes).';
COMMENT ON COLUMN public.audit_logs.metadata IS 'reason, actor_name, target_name, ip, user_agent.';

-- Indexes per spec.
-- (center_id, created_at DESC) — primary list view (newest-first per center).
CREATE INDEX IF NOT EXISTS idx_audit_logs_center_time
    ON public.audit_logs(center_id, created_at DESC);

-- (entity_type, entity_id) — "history of this specific period/item".
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON public.audit_logs(entity_type, entity_id);


-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────
-- Reads: CENTER_ADMIN of the row's center_id only. Cross-center read is
-- a critical bug per PRD §11 acceptance — this is the load-bearing check.
-- Inserts: same gate (WITH CHECK center match) so a CENTER_ADMIN can't
-- forge a log entry pointing at someone else's center.
-- Updates/Deletes: deliberately omitted — audit history is append-only.

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: admin read own center"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_center_admin(center_id));

CREATE POLICY "audit_logs: admin insert own center"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_center_admin(center_id));


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ audit_logs table with action/entity_type/entity_id + before/after JSONB
-- ✅ metadata JSONB for reason / actor_name / ip / user_agent
-- ✅ Indexes: (center_id, created_at DESC) + (entity_type, entity_id)
-- ✅ RLS: read + insert gated by is_center_admin(center_id)
-- ✅ Append-only: no UPDATE/DELETE policies
-- ============================================================================
