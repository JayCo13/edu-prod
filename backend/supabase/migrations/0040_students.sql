-- 0040_students.sql
--
-- Học sinh + đăng ký lớp + học phí + điểm danh per session — dành cho
-- CENTER (trung tâm dạy thêm). SCHOOL không dùng (trường công có hệ
-- thống học sinh riêng qua vnEdu/SMAS; Edura không thay).
--
-- 4 bảng:
--   • students             — danh sách HS + mã HS auto (HS-XXXXXX)
--   • student_enrollments  — đăng ký lớp; lịch sử + chuyển lớp
--   • student_payments     — học phí từng kỳ; tracking PAID/OVERDUE
--   • student_attendance   — điểm danh từng buổi (link live_sessions)

-- ── ENUMs ──────────────────────────────────────────────────────────────
CREATE TYPE public.student_gender AS ENUM ('M', 'F', 'OTHER');

CREATE TYPE public.enrollment_status AS ENUM (
  'ACTIVE',
  'TRANSFERRED',
  'WITHDRAWN',
  'COMPLETED'
);

CREATE TYPE public.billing_cycle AS ENUM (
  'MONTHLY',
  'PER_SESSION',
  'ANNUAL',
  'ONE_TIME'
);

CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'PAID',
  'PARTIAL',
  'OVERDUE',
  'CANCELLED'
);

CREATE TYPE public.attendance_status AS ENUM (
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED'
);

-- ── students ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Mã HS unique per tenant. Format gợi ý "HS-000001" nhưng accept
  -- bất kỳ chuỗi ≤ 30 chars do admin set (hoặc auto-gen).
  student_code    TEXT NOT NULL,

  display_name    TEXT NOT NULL,
  dob             DATE,
  gender          public.student_gender,
  phone           TEXT,
  -- Phụ huynh
  parent_name     TEXT,
  parent_phone    TEXT,
  parent_email    TEXT,
  address         TEXT,
  note            TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, student_code)
);

CREATE INDEX idx_students_tenant ON public.students(tenant_id);
CREATE INDEX idx_students_active ON public.students(tenant_id) WHERE is_active = TRUE;
-- Diacritic-insensitive search dùng app layer; index name lower:
CREATE INDEX idx_students_name_lower ON public.students(tenant_id, LOWER(display_name));

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_admin_select ON public.students
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = students.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY students_admin_write ON public.students
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = students.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = students.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── student_enrollments ──────────────────────────────────────────────
-- 1 HS có thể có nhiều enrollment (1 ACTIVE per (student, class), nhiều
-- ACTIVE qua nhiều class). Khi chuyển lớp: enrollment cũ → TRANSFERRED
-- + new enrollment với transferred_from_enrollment_id trỏ về cũ.
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id                      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id                        UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,

  enrolled_at                     DATE NOT NULL DEFAULT CURRENT_DATE,
  withdrawn_at                    DATE,
  status                          public.enrollment_status NOT NULL DEFAULT 'ACTIVE',

  -- Tuition cho enrollment này (có thể khác giữa các lớp).
  tuition_amount_vnd              BIGINT CHECK (tuition_amount_vnd IS NULL OR tuition_amount_vnd >= 0),
  billing_cycle                   public.billing_cycle DEFAULT 'MONTHLY',
  -- Ngày trong tháng đóng tiền (1-31). Dùng để gen due_date hàng tháng.
  payment_day                     SMALLINT CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31),

  -- Transfer linkage — nếu enrollment này tạo từ chuyển lớp.
  transferred_from_enrollment_id  UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,

  note                            TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enrollments_tenant ON public.student_enrollments(tenant_id);
CREATE INDEX idx_enrollments_student ON public.student_enrollments(student_id);
CREATE INDEX idx_enrollments_class ON public.student_enrollments(class_id);
-- Active enrollments — query nhanh khi list HS của lớp.
CREATE INDEX idx_enrollments_active
  ON public.student_enrollments(class_id, student_id)
  WHERE status = 'ACTIVE';

CREATE TRIGGER trg_student_enrollments_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_admin_select ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_enrollments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY enrollments_admin_write ON public.student_enrollments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_enrollments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_enrollments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── student_payments ──────────────────────────────────────────────────
-- 1 dòng = 1 khoản học phí cho 1 kỳ (tháng/buổi/năm).
-- Status được duy trì bởi app layer khi insert/update/mark paid.
-- Background job (chưa có) hoặc on-read compute có thể flip về OVERDUE.
CREATE TABLE IF NOT EXISTS public.student_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id       UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,

  amount_vnd          BIGINT NOT NULL CHECK (amount_vnd > 0),
  due_date            DATE NOT NULL,
  -- Có thể nhận thanh toán từng phần. paid_amount tích lũy.
  paid_amount_vnd     BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_vnd >= 0),
  paid_date           DATE, -- ngày trả gần nhất, hoặc NULL nếu chưa

  status              public.payment_status NOT NULL DEFAULT 'PENDING',

  payment_method      TEXT, -- 'CASH', 'BANK_TRANSFER', 'MOMO', ...
  receipt_no          TEXT, -- số biên lai
  -- Label kỳ học phí, vd. "Tháng 6/2026", "Khoá hè 2026", "Buổi 5"
  period_label        TEXT NOT NULL DEFAULT '',
  note                TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_tenant ON public.student_payments(tenant_id);
CREATE INDEX idx_payments_student ON public.student_payments(student_id);
CREATE INDEX idx_payments_enrollment ON public.student_payments(enrollment_id);
-- Dashboard alerts — sắp tới hạn / quá hạn — index nhanh.
CREATE INDEX idx_payments_due ON public.student_payments(tenant_id, due_date)
  WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE');

CREATE TRIGGER trg_student_payments_updated_at
  BEFORE UPDATE ON public.student_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_admin_select ON public.student_payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_payments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY payments_admin_write ON public.student_payments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_payments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_payments.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── student_attendance ────────────────────────────────────────────────
-- Per (session × student). UNIQUE để không double-count.
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,

  status          public.attendance_status NOT NULL,
  note            TEXT,

  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by     UUID REFERENCES auth.users(id),

  UNIQUE (session_id, student_id)
);

CREATE INDEX idx_attendance_tenant ON public.student_attendance(tenant_id);
CREATE INDEX idx_attendance_student ON public.student_attendance(student_id);
CREATE INDEX idx_attendance_session ON public.student_attendance(session_id);

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_admin_select ON public.student_attendance
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_attendance.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY attendance_admin_write ON public.student_attendance
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_attendance.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = student_attendance.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- ── live_sessions.class_id ────────────────────────────────────────────
-- CENTER tag class trực tiếp lên session để (a) liệt kê buổi của lớp
-- khi điểm danh, (b) gom số buổi theo lớp cho báo cáo. NULLABLE để
-- SCHOOL (timetable_slots) và legacy sessions không bị ảnh hưởng.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS class_id UUID
    REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_class
  ON public.live_sessions(class_id, start_time)
  WHERE class_id IS NOT NULL;

-- ── Comments ──────────────────────────────────────────────────────────
COMMENT ON TABLE public.students IS
  'Học sinh của trung tâm. student_code unique per tenant.';
COMMENT ON TABLE public.student_enrollments IS
  'Đăng ký lớp. Chuyển lớp = TRANSFERRED + new ACTIVE với transferred_from_enrollment_id trỏ về cũ.';
COMMENT ON TABLE public.student_payments IS
  'Học phí từng kỳ. Status app-managed; sắp tới hạn / quá hạn compute on-read theo due_date vs today.';
COMMENT ON TABLE public.student_attendance IS
  'Điểm danh per session — count tiết HS đã học trong tháng.';
