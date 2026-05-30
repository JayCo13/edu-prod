-- 0037_rate_rules.sql
--
-- Tách đơn giá ra khỏi tenant_teachers → bảng rate_rules.
-- Cùng giáo viên có thể có giá khác nhau theo khóa / lớp.
--
-- + Thêm session_teachers cho co-teaching split.
--
-- KHÔNG drop cột rate cũ trên tenant_teachers — giữ làm fallback transitional.
-- Migration sau (0038+) sẽ drop khi confident.

-- ── ENUM scope ────────────────────────────────────────────────────────────
CREATE TYPE public.rate_scope AS ENUM (
  'TEACHER_DEFAULT',   -- fallback: áp dụng mọi buổi của GV
  'COURSE',            -- scope_id = courses.id
  'CLASS'              -- scope_id = classes.id
  -- SHIFT / CLASS_TYPE: defer, ALTER TYPE ADD VALUE sau khi cần.
);

-- ── Bảng rate_rules ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id              UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,

  scope                   public.rate_scope NOT NULL,
  -- NULL khi scope=TEACHER_DEFAULT. UUID trỏ vào courses/classes theo scope.
  -- KHÔNG dùng FK đa hình vì scope_id reference table khác nhau — validate
  -- ở app layer.
  scope_id                UUID,

  -- Cấu trúc lương tại scope này. Có thể khác nhau theo scope —
  -- vd. HOURLY ở lớp giao tiếp, PER_SESSION ở lớp luyện thi.
  payment_structure       TEXT NOT NULL
    CHECK (payment_structure IN ('HOURLY','PER_SESSION','FIXED_MONTHLY','HYBRID')),
  hourly_rate             BIGINT CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  per_session_rate        BIGINT CHECK (per_session_rate IS NULL OR per_session_rate >= 0),
  fixed_monthly_amount    BIGINT CHECK (fixed_monthly_amount IS NULL OR fixed_monthly_amount >= 0),

  -- Hiệu lực
  effective_from          DATE NOT NULL,
  effective_to            DATE,   -- NULL = vô thời hạn

  -- Tie-break trong cùng scope. Cao hơn = thắng.
  priority                INTEGER NOT NULL DEFAULT 0,

  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validation: TEACHER_DEFAULT phải scope_id IS NULL.
  --             COURSE / CLASS phải scope_id IS NOT NULL.
  CONSTRAINT rate_rules_scope_id_consistency
    CHECK (
      (scope = 'TEACHER_DEFAULT' AND scope_id IS NULL)
      OR (scope <> 'TEACHER_DEFAULT' AND scope_id IS NOT NULL)
    ),
  -- effective_to nếu có phải sau effective_from.
  CONSTRAINT rate_rules_dates_ordered
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_rate_rules_teacher ON public.rate_rules(teacher_id);
CREATE INDEX idx_rate_rules_tenant ON public.rate_rules(tenant_id);
-- Optimize matching: lookup theo (teacher, scope, scope_id) + date range.
CREATE INDEX idx_rate_rules_lookup
  ON public.rate_rules(teacher_id, scope, scope_id, effective_from);

CREATE TRIGGER trg_rate_rules_updated_at
  BEFORE UPDATE ON public.rate_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.rate_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_rules_admin_select ON public.rate_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = rate_rules.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

CREATE POLICY rate_rules_admin_write ON public.rate_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = rate_rules.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = rate_rules.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- ── Bảng session_teachers cho co-teaching ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_teachers (
  session_id       UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  pay_share_pct    SMALLINT NOT NULL CHECK (pay_share_pct BETWEEN 0 AND 100),
  PRIMARY KEY (session_id, teacher_id)
);

CREATE INDEX idx_session_teachers_session ON public.session_teachers(session_id);
CREATE INDEX idx_session_teachers_teacher ON public.session_teachers(teacher_id);

ALTER TABLE public.session_teachers ENABLE ROW LEVEL SECURITY;

-- Đọc: admin của tenant chứa session.
CREATE POLICY session_teachers_admin_select ON public.session_teachers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      JOIN public.user_centers uc
        ON uc.center_id = ls.tenant_id
       AND uc.user_id = auth.uid()
       AND uc.role_in_center = 'CENTER_ADMIN'
      WHERE ls.id = session_teachers.session_id
    )
  );

CREATE POLICY session_teachers_admin_write ON public.session_teachers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      JOIN public.user_centers uc
        ON uc.center_id = ls.tenant_id
       AND uc.user_id = auth.uid()
       AND uc.role_in_center = 'CENTER_ADMIN'
      WHERE ls.id = session_teachers.session_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.live_sessions ls
      JOIN public.user_centers uc
        ON uc.center_id = ls.tenant_id
       AND uc.user_id = auth.uid()
       AND uc.role_in_center = 'CENTER_ADMIN'
      WHERE ls.id = session_teachers.session_id
    )
  );

-- ── Backfill: tạo TEACHER_DEFAULT rule cho mỗi GV có rate ────────────────
-- effective_from = '1900-01-01' để chắc chắn áp cho mọi kỳ lương lịch sử
-- nếu engine chưa cập nhật (vẫn join về tenant_teachers.* cũng được —
-- snapshot đã đông cứng kỳ cũ rồi).

INSERT INTO public.rate_rules (
  tenant_id, teacher_id, scope, scope_id,
  payment_structure, hourly_rate, per_session_rate, fixed_monthly_amount,
  effective_from, effective_to, priority
)
SELECT
  tt.tenant_id,
  tt.id,
  'TEACHER_DEFAULT'::public.rate_scope,
  NULL,
  COALESCE(tt.payment_structure, 'HOURLY'),
  tt.hourly_rate,
  tt.per_session_rate,
  tt.fixed_monthly_amount,
  '1900-01-01'::DATE,
  NULL,
  0
FROM public.tenant_teachers tt
WHERE tt.payment_structure IS NOT NULL
-- Idempotency: chỉ insert nếu chưa có rule TEACHER_DEFAULT cho teacher này.
ON CONFLICT DO NOTHING;

-- ── Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.rate_rules IS
  'Đơn giá giáo viên theo scope (mặc định / khoá / lớp). Mỗi GV phải có ít nhất 1 rule TEACHER_DEFAULT làm fallback. Engine resolve khi build payroll input và snapshot ngay — kỳ đã chốt không re-resolve.';
COMMENT ON COLUMN public.rate_rules.priority IS
  'Tie-break trong cùng scope khi nhiều rule cùng khớp. Cao hơn = thắng.';
COMMENT ON TABLE public.session_teachers IS
  'Co-teaching: nhiều giáo viên cùng dạy 1 buổi với pay_share_pct riêng. Tổng = 100 (validate ở app layer). Buổi không có dòng trong bảng này → solo, dùng live_sessions.teacher_id.';
COMMENT ON COLUMN public.session_teachers.pay_share_pct IS
  'Phần trăm lương theo HOURLY/PER_SESSION. FIXED_MONTHLY không chia.';
