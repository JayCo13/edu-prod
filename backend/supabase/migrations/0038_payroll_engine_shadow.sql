-- 0038_payroll_engine_shadow.sql
--
-- Shadow-run + feature flag cho engine bảng lương mới (rate_rules path).
--
-- Mục tiêu (theo plan #1 final):
--   1. Path mới (`calculatePayrollFromUnits`) đã sẵn nhưng chưa cắm vào
--      service. Cắm an toàn = feature flag per-tenant + shadow-run.
--   2. OLD = default; SHADOW = chạy cả hai engine, lưu kết quả cũ + log
--      diff; NEW = chỉ chạy engine mới.
--   3. Sau vài kỳ shadow xác nhận khớp → flip flag NEW. Sau N kỳ stable
--      trên NEW → migration 0039 drop path cũ.
--
-- Đổi flag = action có trách nhiệm → ghi audit_logs.

-- ── ENUM mode ─────────────────────────────────────────────────────────────
CREATE TYPE public.payroll_engine_mode AS ENUM ('OLD', 'SHADOW', 'NEW');

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS payroll_engine_mode
    public.payroll_engine_mode NOT NULL DEFAULT 'OLD';

COMMENT ON COLUMN public.tenants.payroll_engine_mode IS
  'OLD = path cũ (calculatePayroll, single rate). SHADOW = chạy cả 2 + log diff. NEW = path mới (calculatePayrollFromUnits qua rate_rules). Default OLD; admin chuyển qua UI Cài đặt.';

-- ── Bảng diff log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_engine_shadow_diffs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payroll_period_id   UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  payroll_item_id     UUID NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  teacher_id          UUID NOT NULL,

  old_final_amount    BIGINT NOT NULL,
  new_final_amount    BIGINT NOT NULL,
  diff_amount         BIGINT GENERATED ALWAYS AS (new_final_amount - old_final_amount) STORED,

  -- Breakdown đầy đủ của từng engine để admin drill-down side-by-side.
  old_breakdown       JSONB NOT NULL,
  new_breakdown       JSONB NOT NULL,
  -- Trích các chênh lệch cụ thể + reason_hint heuristic.
  diff_summary        JSONB NOT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (payroll_item_id)
);

CREATE INDEX idx_shadow_diffs_period
  ON public.payroll_engine_shadow_diffs(payroll_period_id);

-- Quan trọng nhất: lọc nhanh các diff != 0 (cần review).
CREATE INDEX idx_shadow_diffs_nonzero
  ON public.payroll_engine_shadow_diffs(tenant_id, payroll_period_id)
  WHERE diff_amount <> 0;

ALTER TABLE public.payroll_engine_shadow_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_diffs_admin_select
  ON public.payroll_engine_shadow_diffs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = payroll_engine_shadow_diffs.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- Service ghi qua admin client (service_role), không cần policy ghi.

COMMENT ON TABLE public.payroll_engine_shadow_diffs IS
  'Log so sánh engine cũ vs mới khi tenant ở SHADOW mode. Mỗi payroll_item có tối đa 1 dòng. diff_amount=new-old. Mục đích: validate trước khi switch sang NEW.';
COMMENT ON COLUMN public.payroll_engine_shadow_diffs.diff_summary IS
  '{ "final_amount": {old,new,delta}, "hourly_pay": ..., ..., "reason_hint": "..." } — chỉ list field khác nhau.';
