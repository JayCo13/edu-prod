-- 0031_tenants_kind.sql
--
-- Soft product split: trung tâm dạy thêm (CENTER) vs tiện ích trường học (SCHOOL).
-- Chosen by the user during onboarding. Same auth/DB/billing infra; nav, copy
-- and feature gating differ at the UI layer based on this flag.
--
-- CENTER  → payroll-first product face. Hides Thời khoá biểu mẫu by default.
-- SCHOOL  → timetable-first product face. Hides Bảng lương / Nhận lương /
--           Lịch dạy from the primary nav.
--
-- All existing rows get CENTER (the original product positioning).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_kind') THEN
    CREATE TYPE public.tenant_kind AS ENUM ('CENTER', 'SCHOOL');
  END IF;
END$$;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS kind public.tenant_kind
    NOT NULL DEFAULT 'CENTER';

COMMENT ON COLUMN public.tenants.kind IS
  'Product face. CENTER = trung tâm dạy thêm (payroll-first). SCHOOL = tiện ích thời khoá biểu trường học. Set during onboarding; affects nav + copy, not data isolation.';
