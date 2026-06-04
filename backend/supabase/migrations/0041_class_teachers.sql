-- 0041_class_teachers.sql
--
-- Liên kết nhiều-nhiều giữa lớp ↔ tenant_teachers, có vai trò:
--   • PRIMARY    — GV chính, default cho mọi buổi tạo mới của lớp.
--                  Chỉ 1 PRIMARY active/lớp (partial unique).
--   • ASSISTANT  — trợ giảng. 0..N người/lớp. Vẫn thấy lịch của lớp
--                  trong calendar nhưng không "phụ trách" buổi.
--
-- Quy ước:
--   - Xoá GV khỏi lớp = DELETE row (không track end_date — payroll +
--     attendance giữ history riêng).
--   - Đổi PRIMARY: app layer update live_sessions.teacher_id cho future
--     sessions (chỉ start_time ≥ now). Past sessions giữ nguyên để
--     lương / điểm danh đã chốt không bị thay đổi.
--   - Live_sessions.teacher_id (đã có từ 0012) tiếp tục là "actual
--     teacher conducting", có thể override per-session cho dạy thay.
--
-- KHÔNG đồng bộ với classes.homeroom_teacher_id (dành cho SCHOOL).
-- CENTER dùng class_teachers; SCHOOL dùng homeroom_teacher_id. Tách
-- riêng để tránh conflict semantics.

CREATE TYPE public.class_teacher_role AS ENUM ('PRIMARY', 'ASSISTANT');

CREATE TABLE IF NOT EXISTS public.class_teachers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES public.tenant_teachers(id) ON DELETE CASCADE,
  role        public.class_teacher_role NOT NULL DEFAULT 'PRIMARY',
  assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1 GV không xuất hiện 2 lần trong cùng lớp (dù khác role).
  -- Đổi role = UPDATE row đó, không INSERT mới.
  UNIQUE (class_id, teacher_id)
);

-- Chỉ tối đa 1 PRIMARY/lớp. Partial unique để ASSISTANT không vướng
-- (ASSISTANT có thể nhiều người/lớp).
CREATE UNIQUE INDEX idx_class_teachers_one_primary
  ON public.class_teachers(class_id)
  WHERE role = 'PRIMARY';

CREATE INDEX idx_class_teachers_tenant ON public.class_teachers(tenant_id);
CREATE INDEX idx_class_teachers_class ON public.class_teachers(class_id);
CREATE INDEX idx_class_teachers_teacher ON public.class_teachers(teacher_id);

CREATE TRIGGER trg_class_teachers_updated_at
  BEFORE UPDATE ON public.class_teachers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- Admin của tenant thấy + sửa.
CREATE POLICY class_teachers_admin_select ON public.class_teachers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = class_teachers.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

CREATE POLICY class_teachers_admin_write ON public.class_teachers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = class_teachers.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_centers uc
    WHERE uc.center_id = class_teachers.tenant_id
      AND uc.user_id = auth.uid()
      AND uc.role_in_center = 'CENTER_ADMIN'
  ));

-- GV (chính chủ) tự thấy assignment của mình — để calendar / dashboard
-- có thể query class_teachers join self.
CREATE POLICY class_teachers_teacher_self_select ON public.class_teachers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_teachers tt
    WHERE tt.id = class_teachers.teacher_id
      AND tt.profile_id = auth.uid()
  ));

COMMENT ON TABLE public.class_teachers IS
  'Lớp ↔ GV (many-to-many). PRIMARY = GV chính (1/lớp, default cho buổi mới). ASSISTANT = trợ giảng (0..N/lớp).';
COMMENT ON COLUMN public.class_teachers.role IS
  'PRIMARY = mỗi class có max 1 (partial unique). ASSISTANT = không giới hạn số lượng.';
