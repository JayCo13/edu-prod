-- 0035_recurring_adjustments.sql
--
-- Phụ cấp / khấu trừ định kỳ — admin khai báo một lần cho mỗi giáo viên,
-- hệ thống tự áp vào mỗi kỳ lương phù hợp.
--
-- Use cases:
--   • Phụ cấp GVCN 500.000đ/tháng (cycle = EVERY)
--   • Phụ cấp xăng đến hết năm học (cycle = UNTIL_DATE, effective_to = '2027-06-30')
--   • Tạm ứng 5.000.000đ trả góp 5 kỳ (cycle = N_PERIODS_LEFT, remaining = 5)
--
-- Engine flow:
--   1. Admin tạo kỳ lương mới → service tính lương gốc qua calculator (như cũ).
--   2. Sau khi có `calculated_amount`, service fetch các recurring rule active
--      cho từng giáo viên trong tenant.
--   3. Mỗi rule applicable → push vào `payroll_items.adjustments[]` cùng tầng
--      với manual bonus/deduction, kèm `source` = `RECURRING:<rule_id>`.
--   4. N_PERIODS_LEFT cycle → decrement `remaining_periods` lúc kỳ được APPROVED
--      (KHÔNG phải lúc tạo DRAFT — để admin xóa draft không mất count).
--
-- Important: tách HOÀN TOÀN khỏi tầng rate resolution. Recurring adjustments
-- chỉ cộng/trừ vào số đã tính ra; không bao giờ đụng `hourly_rate` /
-- `per_session_rate` / `fixed_monthly_amount`.

-- ── Enum trạng thái chu kỳ ─────────────────────────────────────────────────
CREATE TYPE public.recurring_adjustment_cycle AS ENUM (
  'EVERY',            -- áp dụng mỗi kỳ vô thời hạn (vd. phụ cấp GVCN)
  'UNTIL_DATE',       -- áp dụng tới hết `effective_to` (vd. phụ cấp năm học)
  'N_PERIODS_LEFT'    -- áp dụng N kỳ còn lại (vd. tạm ứng trả góp 5 kỳ)
);

CREATE TYPE public.recurring_adjustment_type AS ENUM ('BONUS', 'DEDUCTION');

-- ── Bảng chính ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,

  type          public.recurring_adjustment_type NOT NULL,
  amount_vnd    BIGINT NOT NULL CHECK (amount_vnd > 0),

  -- Mô tả ngắn — sẽ hiển thị trên payroll_items.adjustments[].reason
  reason        TEXT NOT NULL,

  cycle         public.recurring_adjustment_cycle NOT NULL,

  -- Ngày bắt đầu áp dụng. Kỳ lương có `period_end < effective_from` → bỏ qua.
  effective_from   DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Cycle = UNTIL_DATE → bắt buộc. Cycle khác → bỏ qua (cho phép NULL).
  effective_to     DATE,

  -- Cycle = N_PERIODS_LEFT → bắt buộc > 0. Cycle khác → NULL.
  -- Trigger ở app layer giảm dần khi kỳ được duyệt.
  remaining_periods INTEGER CHECK (remaining_periods IS NULL OR remaining_periods >= 0),

  -- Cho phép tạm ngưng mà không xóa (mất audit history).
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validation: cycle phải khớp với field tương ứng.
  CONSTRAINT cycle_until_date_requires_effective_to
    CHECK (cycle <> 'UNTIL_DATE' OR effective_to IS NOT NULL),
  CONSTRAINT cycle_n_periods_requires_remaining
    CHECK (cycle <> 'N_PERIODS_LEFT' OR remaining_periods IS NOT NULL)
);

CREATE INDEX idx_recurring_adj_tenant ON public.recurring_adjustments(tenant_id);
CREATE INDEX idx_recurring_adj_teacher ON public.recurring_adjustments(teacher_id);

-- Truy vấn lúc tạo kỳ lương: lọc nhanh các rule active cho 1 tenant.
CREATE INDEX idx_recurring_adj_active
  ON public.recurring_adjustments(tenant_id, teacher_id)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_recurring_adjustments_updated_at
  BEFORE UPDATE ON public.recurring_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.recurring_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin của tenant quản lý được recurring adjustments của tenant đó.
-- Dùng membership qua user_centers (chuẩn mới, hậu migration 0013).
CREATE POLICY recurring_adj_admin_select ON public.recurring_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = recurring_adjustments.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

CREATE POLICY recurring_adj_admin_write ON public.recurring_adjustments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = recurring_adjustments.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = recurring_adjustments.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

COMMENT ON TABLE public.recurring_adjustments IS
  'Phụ cấp / khấu trừ định kỳ. Admin khai báo 1 lần, hệ thống tự áp vào mỗi kỳ lương — cùng tầng với bonus/deduction manual, KHÔNG đụng tầng rate.';
COMMENT ON COLUMN public.recurring_adjustments.cycle IS
  'EVERY = vô thời hạn. UNTIL_DATE = tới hết effective_to. N_PERIODS_LEFT = N kỳ còn lại (giảm dần khi kỳ APPROVED).';
COMMENT ON COLUMN public.recurring_adjustments.remaining_periods IS
  'Chỉ dùng khi cycle=N_PERIODS_LEFT. App layer decrement khi kỳ chứa rule này chuyển sang APPROVED.';
