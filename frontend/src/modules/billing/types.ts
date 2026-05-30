// ── Domain types cho module billing ────────────────────────────────────────

export type BillType = "ORG" | "INDIVIDUAL";

export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED";

export type SubscriptionPlan = "EARLY_ACCESS" | "GROWTH" | "CUSTOM";

export type PaymentOrderStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export type SInvoiceStatus = "PENDING" | "ISSUED" | "FAILED";

export interface BillingInfoRow {
  tenant_id: string;
  bill_type: BillType;
  company_name: string | null;
  tax_code: string | null;
  address: string | null;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  price_vnd: number;
  current_period_start: string;
  current_period_end: string;
  grace_days: number;
  billing_cycle: "MONTHLY";
  meter_snapshot: Record<string, unknown> | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrderRow {
  id: string;
  subscription_id: string;
  tenant_id: string;
  payos_order_code: number;
  amount_vnd: number;
  status: PaymentOrderStatus;
  checkout_url: string | null;
  description: string;
  paid_at: string | null;
  expires_at: string | null;
  webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SInvoiceRow {
  id: string;
  payment_order_id: string;
  tenant_id: string;
  invoice_no: string | null;
  status: SInvoiceStatus;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

// Trạng thái tổng hợp dùng cho UI billing page.
export interface BillingOverview {
  billingInfo: BillingInfoRow | null;
  subscription: SubscriptionRow | null;
  recentPayments: PaymentOrderRow[];
}

// Hằng số nghiệp vụ — chỗ duy nhất giữ giá hiện tại của các gói. Khi đổi
// giá thì sửa ở đây + bump nếu có nâng cấp.
export const PLAN_CATALOG: Record<
  SubscriptionPlan,
  { name: string; priceVnd: number; cycle: "MONTHLY" }
> = {
  EARLY_ACCESS: { name: "Early Access", priceVnd: 0, cycle: "MONTHLY" },
  GROWTH: { name: "Growth", priceVnd: 500_000, cycle: "MONTHLY" },
  CUSTOM: { name: "Liên hệ", priceVnd: 0, cycle: "MONTHLY" },
};
