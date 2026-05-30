-- 0034_billing_payos.sql
--
-- Billing + PayOS + sInvoice schema (PRD §1.3).
--
-- Mỗi tenant có:
--   • 1 dòng billing_info — thông tin xuất hoá đơn (tổ chức có MST hoặc cá nhân).
--   • 0 hoặc 1 dòng subscriptions ACTIVE — gói đang dùng + chu kỳ trả tiền.
--   • Nhiều payment_orders — mỗi lần generate payment link qua PayOS = 1 order.
--   • sinvoice_records — log hoá đơn điện tử PayOS đẩy sang sInvoice (Viettel).
--
-- Auto-renew ở VN không phải auto-charge: mỗi cuối chu kỳ, hệ thống tạo
-- payment link mới + email nhắc; user chủ động trả; nếu quá grace period
-- không trả → subscription chuyển PAST_DUE → SUSPENDED.

-- ── Bảng billing_info ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_info (
  tenant_id     UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- ORG: doanh nghiệp / trường có MST, hoá đơn xuất có thể khấu trừ thuế.
  -- INDIVIDUAL: cá nhân — không có MST, vẫn xuất hoá đơn được nhưng không
  -- dùng để khấu trừ chi phí. UI cho user chọn lúc khai báo.
  bill_type     TEXT NOT NULL CHECK (bill_type IN ('ORG', 'INDIVIDUAL')),

  -- ORG fields. NULL nếu bill_type = INDIVIDUAL.
  company_name  TEXT,
  tax_code      TEXT,   -- MST: 10 hoặc 13 ký tự, validate ở app layer.
  address       TEXT,

  -- Người nhận hoá đơn (cả ORG lẫn INDIVIDUAL đều có).
  recipient_name   TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  recipient_phone  TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Đảm bảo ORG luôn có MST + tên công ty.
  CONSTRAINT billing_info_org_requires_tax_code
    CHECK (bill_type = 'INDIVIDUAL' OR (tax_code IS NOT NULL AND company_name IS NOT NULL))
);

CREATE TRIGGER trg_billing_info_updated_at
  BEFORE UPDATE ON public.billing_info
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;

-- Admin của tenant đọc / sửa được billing_info của tenant đó.
CREATE POLICY billing_info_admin_select ON public.billing_info
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = billing_info.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

CREATE POLICY billing_info_admin_upsert ON public.billing_info
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = billing_info.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = billing_info.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- ── Bảng subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Gói đang dùng. Mở rộng sau khi có nhiều tier.
  plan          TEXT NOT NULL CHECK (plan IN ('EARLY_ACCESS', 'GROWTH', 'CUSTOM')),

  -- Trạng thái — state machine:
  --   TRIAL    → đang dùng thử miễn phí (early access)
  --   ACTIVE   → đã thanh toán cho chu kỳ hiện tại
  --   PAST_DUE → hết chu kỳ chưa thanh toán, còn trong grace period
  --   SUSPENDED→ quá grace period, app bị khoá tới khi trả tiền
  --   CANCELLED→ user chủ động huỷ
  status        TEXT NOT NULL CHECK (status IN
                  ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED')),

  -- Giá tính bằng đồng VND (integer, không float).
  price_vnd     BIGINT NOT NULL DEFAULT 0,

  -- Chu kỳ thanh toán hiện tại. period_end là deadline cho user trả tiền
  -- chu kỳ kế tiếp; sau period_end + grace_days mà chưa trả → SUSPENDED.
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  grace_days            INTEGER NOT NULL DEFAULT 7,

  -- billing_cycle: hiện chỉ hỗ trợ MONTHLY. Mở rộng sau (ANNUAL, QUARTERLY).
  billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY')),

  -- Snapshot meter của chu kỳ này (dùng cho audit / display).
  -- center → active_teachers_count, school → active_classes_count.
  meter_snapshot JSONB DEFAULT '{}'::JSONB,

  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mỗi tenant chỉ được có MỘT subscription đang TRIAL/ACTIVE/PAST_DUE/SUSPENDED
  -- cùng lúc. CANCELLED có thể tồn tại nhiều dòng (lịch sử huỷ).
  CONSTRAINT subscriptions_one_live_per_tenant
    EXCLUDE USING btree (tenant_id WITH =)
    WHERE (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'))
);

CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status)
  WHERE status IN ('ACTIVE', 'PAST_DUE');

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin xem được subscription của tenant mình. Server action ghi qua
-- service-role bypass RLS — không cho client tự sửa status / period.
CREATE POLICY subscriptions_admin_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = subscriptions.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- ── Bảng payment_orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- PayOS cấp orderCode dạng số nguyên duy nhất per giao dịch (max 9007199254740991).
  -- Lưu BIGINT vì PayOS chỉ chấp nhận số nguyên (không phải UUID).
  payos_order_code  BIGINT NOT NULL UNIQUE,

  -- Tiền trên payment link, tính bằng đồng VND.
  amount_vnd        BIGINT NOT NULL CHECK (amount_vnd > 0),

  -- Trạng thái — PayOS webhook update field này:
  --   PENDING  → đã tạo link, user chưa trả
  --   PAID     → user trả thành công (PayOS webhook code = "00")
  --   FAILED   → user huỷ / quá hạn / thất bại
  --   EXPIRED  → link hết hạn (sau 15 phút mặc định của PayOS)
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),

  -- URL checkout PayOS trả về sau khi gọi createPaymentLink.
  checkout_url      TEXT,

  -- Mô tả ngắn hiển thị trên màn hình thanh toán PayOS (≤ 25 ký tự theo
  -- giới hạn của họ).
  description       TEXT NOT NULL,

  paid_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,

  -- Raw payload từ PayOS webhook để debug. Lưu cả khi PAID lẫn FAILED.
  webhook_payload   JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_orders_subscription ON public.payment_orders(subscription_id);
CREATE INDEX idx_payment_orders_tenant ON public.payment_orders(tenant_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status)
  WHERE status = 'PENDING';

CREATE TRIGGER trg_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_orders_admin_select ON public.payment_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = payment_orders.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- ── Bảng sinvoice_records ─────────────────────────────────────────────────
-- Log mỗi lần PayOS đẩy giao dịch sang sInvoice (Viettel). Không phải nguồn
-- sự thật — sự thật là dữ liệu bên Viettel. Chỉ để hiển thị link tải về
-- hoá đơn + audit nếu PayOS Workflow trả về lỗi.
CREATE TABLE IF NOT EXISTS public.sinvoice_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id  UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Mã hoá đơn do sInvoice cấp (vd. "HD-00000123").
  invoice_no        TEXT,

  -- Trạng thái xuất hoá đơn từ PayOS Workflow:
  --   PENDING   → PayOS đang đẩy sang sInvoice
  --   ISSUED    → sInvoice đã phát hành thành công
  --   FAILED    → sInvoice từ chối (sai MST, thiếu thông tin…)
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ISSUED', 'FAILED')),

  -- Link PDF / XML xem hoá đơn. sInvoice gửi email cho khách trực tiếp,
  -- field này dùng để admin xem lại nếu cần.
  pdf_url           TEXT,
  xml_url           TEXT,

  -- Lỗi từ sInvoice nếu status = FAILED.
  error_message     TEXT,

  issued_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sinvoice_payment ON public.sinvoice_records(payment_order_id);
CREATE INDEX idx_sinvoice_tenant ON public.sinvoice_records(tenant_id);

CREATE TRIGGER trg_sinvoice_records_updated_at
  BEFORE UPDATE ON public.sinvoice_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.sinvoice_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY sinvoice_records_admin_select ON public.sinvoice_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.center_id = sinvoice_records.tenant_id
        AND uc.user_id = auth.uid()
        AND uc.role_in_center = 'CENTER_ADMIN'
    )
  );

-- ── Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.billing_info IS
  'Thông tin xuất hoá đơn của mỗi tenant. ORG kèm MST hoặc cá nhân.';
COMMENT ON TABLE public.subscriptions IS
  'Gói đăng ký theo tháng. Mỗi tenant chỉ có 1 dòng live (TRIAL/ACTIVE/PAST_DUE/SUSPENDED).';
COMMENT ON TABLE public.payment_orders IS
  'Mỗi payment link PayOS = 1 dòng. Webhook update status.';
COMMENT ON TABLE public.sinvoice_records IS
  'Log hoá đơn điện tử PayOS đẩy sang sInvoice. Không phải nguồn sự thật — chỉ để hiển thị + audit.';
