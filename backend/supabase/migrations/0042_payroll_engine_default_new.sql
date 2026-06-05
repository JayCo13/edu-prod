-- 0042_payroll_engine_default_new.sql
--
-- Quyết định sản phẩm 2026-06-05: tất cả trung tâm dùng engine NEW
-- (rate_rules + co-teaching). Migration 0038 trước đây để DEFAULT 'OLD'
-- vì cần shadow-run an toàn — giờ engine mới đã ổn định, không user
-- production nên dọn lại.
--
-- 2 việc:
--   1. Backfill mọi tenant hiện có sang 'NEW'.
--   2. Đổi DEFAULT của column sang 'NEW' cho tenant tạo mới.
--
-- KHÔNG xoá column, KHÔNG xoá enum value 'OLD'/'SHADOW'. Backend code
-- vẫn handle 3 mode; chỉ giá trị thực trong DB là 'NEW'. Nếu sau cần
-- rollback hoặc shadow-test feature mới, có thể đặt lại bằng SQL.

UPDATE public.tenants
SET payroll_engine_mode = 'NEW'
WHERE payroll_engine_mode <> 'NEW';

ALTER TABLE public.tenants
  ALTER COLUMN payroll_engine_mode SET DEFAULT 'NEW';

COMMENT ON COLUMN public.tenants.payroll_engine_mode IS
  'Hệ thống tính lương đang dùng. Mặc định ''NEW'' (engine mới — rate_rules + co-teaching). Giá trị ''OLD''/''SHADOW'' giữ trong enum để rollback / shadow-test nếu cần.';
