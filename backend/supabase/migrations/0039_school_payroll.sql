-- 0039_school_payroll.sql
--
-- Schema cho payroll trường học (cấp 1/2/3 phổ thông Việt Nam) — tách
-- HOÀN TOÀN khỏi engine trung tâm (calculatePayroll / rate_rules).
-- Tái sử dụng: payroll_periods, audit_logs, Excel framework.
-- Pháp lý: TT 05/2025/TT-BGDĐT (định mức + giảm trừ),
--          TT 21/2025/TT-BGDĐT (đơn giá + thừa giờ 150%).
--
-- Đặc điểm riêng của trường (so với trung tâm):
--   1. Đơn vị tính: TIẾT, không phải giờ/buổi.
--   2. Định mức tính theo NĂM HỌC (1/7 → 30/6), không phải tháng.
--   3. Đơn giá tính từ HỆ SỐ LƯƠNG từng GV (compute), hoặc flat (trường tư).
--   4. Lương cơ sở + hệ số có thể đổi giữa năm → time-series, không flat.
--   5. Thừa giờ trần 200 tiết/năm/GV.
--   6. Tạm ứng có thể vượt quyết toán → handle âm.

-- ── ENUMs ──────────────────────────────────────────────────────────────
CREATE TYPE public.substitution_type AS ENUM (
  'SUBSTITUTE'        -- GV khác dạy thay. Mở rộng 'MAKEUP' sau khi cần.
);

CREATE TYPE public.substitution_reason AS ENUM (
  'ÔM',
  'PHÉP',
  'KHÔNG_PHÉP',
  'CÔNG_TÁC',
  'BỒI_DƯỠNG',
  'KHÁC'
);

CREATE TYPE public.quota_reduction_type AS ENUM (
  'GVCN',           -- giáo viên chủ nhiệm
  'TO_TRUONG',      -- tổ trưởng chuyên môn
  'TO_PHO',         -- tổ phó
  'TO_TRUONG_HS',   -- tổ trưởng quản lý HS (nội trú/bán trú)
  'TO_PHO_HS',
  'KHAC'            -- giảm trừ tự định (trường tư hoặc case ngoài TT)
);

-- ── tenants.default_periods_per_week ──────────────────────────────────
-- Default theo cấp (TH=23 / THCS=19 / THPT=17 / DTNT khác). Admin set
-- lúc tạo trường; teacher_period_quotas có thể override per-teacher.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_periods_per_week INTEGER;

COMMENT ON COLUMN public.tenants.default_periods_per_week IS
  'Định mức tiết/tuần mặc định cho trường (TH=23, THCS=19, THPT=17, DTNT khác). teacher_period_quotas.base_periods_per_week NULL = lấy default này. Trường tư đặt tự do.';

-- ── Bảng năm học ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_year_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Vd. "2025-2026". Quy ước nhà nước: năm học 1/7 → 30/6.
  year_label      TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,

  -- TT 05/2025: 37 tuần dạy (35 thực + 2 dự phòng). Trường có thể
  -- override (nghỉ lễ địa phương, dịch, sự kiện).
  teaching_weeks  INTEGER NOT NULL DEFAULT 37 CHECK (teaching_weeks BETWEEN 1 AND 52),

  -- Các ngày nghỉ lễ trong năm — trừ khi cần (engine không tự đoán).
  holidays_jsonb  JSONB NOT NULL DEFAULT '[]'::JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, year_label),
  CHECK (end_date > start_date)
);

CREATE INDEX idx_school_year_tenant ON public.school_year_periods(tenant_id);

CREATE TRIGGER trg_school_year_periods_updated_at
  BEFORE UPDATE ON public.school_year_periods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.school_year_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_year_admin_select ON public.school_year_periods
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = school_year_periods.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY school_year_admin_write ON public.school_year_periods
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = school_year_periods.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = school_year_periods.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── Định mức tiết/tuần per GV ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_period_quotas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id              UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  school_year_id          UUID NOT NULL REFERENCES public.school_year_periods(id) ON DELETE CASCADE,

  -- NULL = lấy tenants.default_periods_per_week.
  base_periods_per_week   INTEGER CHECK (
    base_periods_per_week IS NULL OR base_periods_per_week BETWEEN 1 AND 50
  ),

  -- Mảng giảm trừ: [{type: 'GVCN', minus: 4, allowance_received: false, note: '...'}, ...]
  -- TT 05: tối đa 2 nhiệm vụ kiêm nhiệm. Helper enforce constraint này
  -- ở app layer (CHECK constraint trên JSONB phức tạp).
  -- `allowance_received = true` → đã nhận phụ cấp/thù lao → KHÔNG giảm
  -- định mức (theo TT 05). Helper xử lý logic.
  reductions              JSONB NOT NULL DEFAULT '[]'::JSONB,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, teacher_id, school_year_id)
);

CREATE INDEX idx_teacher_quotas_teacher ON public.teacher_period_quotas(teacher_id);
CREATE INDEX idx_teacher_quotas_year ON public.teacher_period_quotas(school_year_id);

CREATE TRIGGER trg_teacher_period_quotas_updated_at
  BEFORE UPDATE ON public.teacher_period_quotas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_period_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_quotas_admin_select ON public.teacher_period_quotas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_period_quotas.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY teacher_quotas_admin_write ON public.teacher_period_quotas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_period_quotas.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_period_quotas.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── Cơ sở tính lương per GV — TIME-SERIES ─────────────────────────────
-- Đây là phần dễ sai nhất theo review: lương cơ sở (2.34M, nhà nước có
-- thể đổi giữa năm) và hệ số lương (nâng bậc 3 năm/lần) thay đổi giữa
-- năm học. Engine compute đơn giá theo TỪNG SEGMENT, không phẳng cả năm.
CREATE TABLE IF NOT EXISTS public.teacher_salary_basis (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id                 UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  school_year_id             UUID NOT NULL REFERENCES public.school_year_periods(id) ON DELETE CASCADE,

  -- ── Mode A: Trường công — compute từ hệ số ──
  -- Tiền lương 1 tiết = (Tổng 12 tháng) / Định mức năm.
  -- Tổng 12 tháng = (salary_coefficient × base_salary) + position + other + bao_luu × base_salary
  salary_coefficient         DECIMAL(5, 2),      -- vd. 2.34
  base_salary_vnd            BIGINT,             -- lương cơ sở nhà nước, vd. 2_340_000
  position_allowance_vnd     BIGINT NOT NULL DEFAULT 0,  -- phụ cấp chức vụ
  other_allowances_vnd       BIGINT NOT NULL DEFAULT 0,  -- phụ cấp lương khác (TNVK, độc hại, vùng…)
  bao_luu_coefficient        DECIMAL(5, 2) NOT NULL DEFAULT 0,  -- hệ số chênh lệch bảo lưu

  -- ── Mode B: Trường tư — flat ──
  -- Nếu set → override toàn bộ compute logic.
  flat_rate_per_period_vnd   BIGINT,

  -- Time-series: cùng 1 GV trong 1 năm học có thể có nhiều dòng nếu
  -- lương đổi giữa năm. Helper computePeriodRateSegments đọc tất cả
  -- + compute theo từng giai đoạn.
  effective_from             DATE NOT NULL,
  effective_to               DATE,  -- NULL = đến hết năm học

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Bắt buộc: hoặc đầy đủ Mode A, hoặc Mode B, không cả hai.
  CONSTRAINT salary_basis_mode_consistent CHECK (
    (
      flat_rate_per_period_vnd IS NOT NULL
      AND salary_coefficient IS NULL
      AND base_salary_vnd IS NULL
    )
    OR (
      flat_rate_per_period_vnd IS NULL
      AND salary_coefficient IS NOT NULL
      AND base_salary_vnd IS NOT NULL
    )
  ),
  CONSTRAINT salary_basis_dates_ordered CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX idx_salary_basis_teacher_year
  ON public.teacher_salary_basis(teacher_id, school_year_id, effective_from);
CREATE INDEX idx_salary_basis_tenant ON public.teacher_salary_basis(tenant_id);

CREATE TRIGGER trg_teacher_salary_basis_updated_at
  BEFORE UPDATE ON public.teacher_salary_basis
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_salary_basis ENABLE ROW LEVEL SECURITY;

CREATE POLICY salary_basis_admin_select ON public.teacher_salary_basis
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_salary_basis.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY salary_basis_admin_write ON public.teacher_salary_basis
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_salary_basis.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_salary_basis.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── Dạy thay ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.substitutions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  school_year_id           UUID NOT NULL REFERENCES public.school_year_periods(id) ON DELETE CASCADE,

  -- Mở rộng tương lai (MAKEUP) qua ALTER TYPE.
  type                     public.substitution_type NOT NULL DEFAULT 'SUBSTITUTE',

  -- Nguồn buổi/tiết: TKB cố định (timetable_slots) HOẶC session calendar
  -- (live_sessions). Trường thường dùng TKB; engine cần xử lý cả 2.
  timetable_slot_id        UUID REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  session_id               UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,

  -- Snapshot date/period — để query nhanh, không phải JOIN slot mỗi lần.
  date                     DATE NOT NULL,
  period_index             INTEGER NOT NULL CHECK (period_index BETWEEN 1 AND 20),
  shift                    TEXT,  -- 'SANG' / 'CHIEU' / 'TOI' nếu cần

  -- 2 GV liên quan (cả hai NOT NULL — substitute KHÔNG được trùng original).
  original_teacher_id      UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  substitute_teacher_id    UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,

  reason                   public.substitution_reason NOT NULL DEFAULT 'KHÁC',
  reason_note              TEXT,

  -- ── Flags lương ──
  -- pay_substitute=true → GV thay được trả 1 tiết (cộng vào thực dạy).
  -- deduct_original_flag=true → GHI NHẬN cờ trừ lương GV gốc, nhưng
  -- MVP engine KHÔNG tự trừ tiền. Trừ lương biên chế phải qua kho bạc,
  -- cơ chế ngoài Edura. Chỉ flag + lý do để admin xử lý hành chính.
  pay_substitute           BOOLEAN NOT NULL DEFAULT TRUE,
  deduct_original_flag     BOOLEAN NOT NULL DEFAULT FALSE,
  deduct_original_note     TEXT,

  created_by               UUID REFERENCES auth.users(id),
  approved_by              UUID REFERENCES auth.users(id),
  approved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT substitutions_source_required CHECK (
    timetable_slot_id IS NOT NULL OR session_id IS NOT NULL
  ),
  CONSTRAINT substitutions_different_teachers CHECK (
    original_teacher_id <> substitute_teacher_id
  )
);

CREATE INDEX idx_substitutions_year ON public.substitutions(school_year_id);
CREATE INDEX idx_substitutions_original ON public.substitutions(original_teacher_id, date);
CREATE INDEX idx_substitutions_substitute ON public.substitutions(substitute_teacher_id, date);
CREATE INDEX idx_substitutions_date ON public.substitutions(tenant_id, date);
-- Một tiết cụ thể chỉ có 1 substitution active per slot:
CREATE UNIQUE INDEX idx_substitutions_unique_slot
  ON public.substitutions(timetable_slot_id, date)
  WHERE timetable_slot_id IS NOT NULL;

CREATE TRIGGER trg_substitutions_updated_at
  BEFORE UPDATE ON public.substitutions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY substitutions_admin_select ON public.substitutions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = substitutions.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY substitutions_admin_write ON public.substitutions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = substitutions.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = substitutions.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── Tạm ứng thừa giờ ──────────────────────────────────────────────────
-- TT 21: thanh toán cuối năm học, NHƯNG cho phép tạm ứng theo tháng/HK.
-- Mỗi lần tạm ứng = 1 dòng, liên kết payroll_period cụ thể đã chi.
-- Cuối năm engine cấn trừ: nếu sum(advances) > quyết toán → âm.
CREATE TABLE IF NOT EXISTS public.teacher_overtime_advances (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id                      UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  school_year_id                  UUID NOT NULL REFERENCES public.school_year_periods(id) ON DELETE CASCADE,
  payroll_period_id               UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,

  advance_amount_vnd              BIGINT NOT NULL CHECK (advance_amount_vnd > 0),

  -- Snapshot tại thời điểm tạm ứng — để admin xem lại "lúc đó GV
  -- tích lũy bao nhiêu tiết, ứng % nào".
  cumulative_periods_at_advance   INTEGER NOT NULL,
  cumulative_overtime_amount_at_advance  BIGINT NOT NULL,

  notes                           TEXT,
  created_by                      UUID REFERENCES auth.users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overtime_advances_teacher_year
  ON public.teacher_overtime_advances(teacher_id, school_year_id);
CREATE INDEX idx_overtime_advances_period
  ON public.teacher_overtime_advances(payroll_period_id);

ALTER TABLE public.teacher_overtime_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY overtime_advances_admin_select ON public.teacher_overtime_advances
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = teacher_overtime_advances.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- Ghi qua service (admin client). Không có policy WRITE cho user thường.

-- ── Comments ──────────────────────────────────────────────────────────
COMMENT ON TABLE public.school_year_periods IS
  'Năm học (1/7 → 30/6) per trường. teaching_weeks default 37 theo TT 05/2025; admin override khi có nghỉ lễ địa phương.';
COMMENT ON TABLE public.teacher_period_quotas IS
  'Định mức tiết/tuần per GV per năm học. base NULL = lấy tenants.default. reductions[] theo TT 05 (GVCN −4, tổ trưởng −3, tổ phó −1...). Helper enforce max 2 nhiệm vụ + bỏ qua reduction đã nhận phụ cấp.';
COMMENT ON TABLE public.teacher_salary_basis IS
  'Cơ sở tính đơn giá tiết per GV. TIME-SERIES: nhiều dòng/năm nếu lương đổi giữa năm. Mode A (compute) cho trường công; Mode B (flat) cho trường tư. Engine compute từng segment + weighted avg.';
COMMENT ON TABLE public.substitutions IS
  'Dạy thay (substitute). MVP: pay_substitute = trả GV thay; deduct_original_flag = chỉ GHI NHẬN cờ trừ lương GV gốc, KHÔNG tự trừ tiền (cơ chế trừ lương biên chế ngoài Edura).';
COMMENT ON TABLE public.teacher_overtime_advances IS
  'Tạm ứng thừa giờ trong năm học. Cuối năm engine cấn trừ — có thể ra số ÂM nếu thừa giờ thực < tạm ứng.';
