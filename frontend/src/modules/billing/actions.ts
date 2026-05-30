"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderCode, getPayOS } from "@/lib/payos/client";

import {
  PLAN_CATALOG,
  type BillingInfoRow,
  type BillingOverview,
  type PaymentOrderRow,
  type SubscriptionPlan,
  type SubscriptionRow,
} from "./types";

// ── Result types ──────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

function err(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Lỗi không xác định";
  return { success: false, error: msg };
}

// ── Lấy tổng quan billing của tenant hiện tại ─────────────────────────────

export async function getBillingOverview(): Promise<
  ActionResult<BillingOverview>
> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xem được thông tin thanh toán." };
    }

    const [billingRes, subRes, paymentsRes] = await Promise.all([
      supabase
        .from("billing_info")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .in("status", ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("payment_orders")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (billingRes.error) return { success: false, error: billingRes.error.message };
    if (subRes.error) return { success: false, error: subRes.error.message };
    if (paymentsRes.error) return { success: false, error: paymentsRes.error.message };

    return {
      success: true,
      data: {
        billingInfo: (billingRes.data ?? null) as BillingInfoRow | null,
        subscription: (subRes.data ?? null) as SubscriptionRow | null,
        recentPayments: (paymentsRes.data ?? []) as PaymentOrderRow[],
      },
    };
  } catch (e) {
    return err(e);
  }
}

// ── Lưu thông tin xuất hoá đơn ────────────────────────────────────────────

// MST Việt Nam: 10 hoặc 13 chữ số (13 cho chi nhánh). Validate cơ bản.
const taxCodeRegex = /^\d{10}(-\d{3})?$/;

const billingInfoSchema = z
  .object({
    bill_type: z.enum(["ORG", "INDIVIDUAL"]),
    company_name: z.string().trim().max(200).nullable().optional(),
    tax_code: z.string().trim().max(20).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    recipient_name: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên người nhận.")
      .max(200),
    recipient_email: z.string().trim().email("Email không hợp lệ.").max(200),
    recipient_phone: z.string().trim().max(20).nullable().optional(),
  })
  .refine(
    (d) => {
      if (d.bill_type !== "ORG") return true;
      return (
        !!d.tax_code &&
        taxCodeRegex.test(d.tax_code) &&
        !!d.company_name &&
        d.company_name.length > 0
      );
    },
    {
      message:
        "Khi xuất hoá đơn cho tổ chức, vui lòng nhập tên công ty và MST (10 hoặc 10-3 chữ số).",
      path: ["tax_code"],
    },
  );

export async function saveBillingInfo(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên cập nhật được thông tin xuất hoá đơn." };
    }

    const parsed = billingInfoSchema.safeParse({
      bill_type: formData.get("bill_type"),
      company_name: formData.get("company_name") || null,
      tax_code: formData.get("tax_code") || null,
      address: formData.get("address") || null,
      recipient_name: formData.get("recipient_name"),
      recipient_email: formData.get("recipient_email"),
      recipient_phone: formData.get("recipient_phone") || null,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }

    const payload = {
      tenant_id: tenant.id,
      ...parsed.data,
      // Nếu INDIVIDUAL thì xoá các trường ORG.
      ...(parsed.data.bill_type === "INDIVIDUAL"
        ? { company_name: null, tax_code: null }
        : {}),
    };

    const { error } = await supabase
      .from("billing_info")
      .upsert(payload, { onConflict: "tenant_id" });
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/billing");
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

// ── Tạo payment link qua PayOS ────────────────────────────────────────────
//
// Flow:
//   1. Đảm bảo tenant có billing_info (cần MST/tên tổ chức để sInvoice xuất
//      hoá đơn). Nếu chưa có → từ chối, hướng user về settings.
//   2. Lấy hoặc tạo subscription cho gói chỉ định.
//   3. Tạo dòng payment_orders (status=PENDING).
//   4. Gọi PayOS createPaymentLink với buyer info từ billing_info.
//   5. Cập nhật checkout_url + return về cho UI redirect.
//
// Quan trọng: dùng admin client (service-role) để insert payment_orders +
// subscriptions vì RLS chỉ cho SELECT từ user thường.

const createPaymentLinkSchema = z.object({
  plan: z.enum(["GROWTH", "CUSTOM"]),
});

export interface CreatePaymentLinkResult {
  checkoutUrl: string;
  orderCode: number;
  amount: number;
}

export async function createPaymentLink(
  input: z.infer<typeof createPaymentLinkSchema>,
): Promise<ActionResult<CreatePaymentLinkResult>> {
  try {
    const parsed = createPaymentLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Gói không hợp lệ." };
    }

    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên thực hiện thanh toán được." };
    }

    // ── (1) Kiểm tra billing_info ──
    const { data: billingInfo } = await supabase
      .from("billing_info")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (!billingInfo) {
      return {
        success: false,
        error:
          "Bạn cần khai báo thông tin xuất hoá đơn trước khi thanh toán. Vào mục Cài đặt → Hoá đơn.",
      };
    }

    const plan: SubscriptionPlan = parsed.data.plan;
    const planSpec = PLAN_CATALOG[plan];
    if (planSpec.priceVnd <= 0) {
      return {
        success: false,
        error: "Gói này chưa có giá tự động — vui lòng liên hệ qua email.",
      };
    }

    const admin = createAdminClient();

    // ── (2) Lấy hoặc tạo subscription ──
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenant.id)
      .in("status", ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"])
      .maybeSingle();

    let subscriptionId: string;
    if (existingSub) {
      subscriptionId = existingSub.id as string;
    } else {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: newSub, error: subErr } = await admin
        .from("subscriptions")
        .insert({
          tenant_id: tenant.id,
          plan,
          status: "TRIAL", // Sẽ chuyển ACTIVE sau khi PayOS confirm
          price_vnd: planSpec.priceVnd,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select("id")
        .single();
      if (subErr || !newSub) {
        return { success: false, error: subErr?.message ?? "Không tạo được gói đăng ký." };
      }
      subscriptionId = newSub.id as string;
    }

    // ── (3) Tạo payment_orders ──
    const orderCode = generateOrderCode();
    const description = `Edura ${plan} ${new Date().toISOString().slice(0, 7)}`.slice(0, 25);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    const { error: orderErr } = await admin.from("payment_orders").insert({
      subscription_id: subscriptionId,
      tenant_id: tenant.id,
      payos_order_code: orderCode,
      amount_vnd: planSpec.priceVnd,
      status: "PENDING",
      description,
      expires_at: expiresAt.toISOString(),
    });
    if (orderErr) return { success: false, error: orderErr.message };

    // ── (4) Gọi PayOS ──
    const reqHeaders = await headers();
    const host = reqHeaders.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const payos = getPayOS();
    const isOrg = billingInfo.bill_type === "ORG";
    const result = await payos.paymentRequests.create({
      orderCode,
      amount: planSpec.priceVnd,
      description,
      cancelUrl: `${origin}/admin/billing?status=cancel&order=${orderCode}`,
      returnUrl: `${origin}/admin/billing?status=success&order=${orderCode}`,
      buyerName: billingInfo.recipient_name as string,
      buyerEmail: billingInfo.recipient_email as string,
      buyerPhone: (billingInfo.recipient_phone as string | null) ?? undefined,
      buyerAddress: (billingInfo.address as string | null) ?? undefined,
      buyerCompanyName: isOrg
        ? (billingInfo.company_name as string)
        : undefined,
      buyerTaxCode: isOrg ? (billingInfo.tax_code as string) : undefined,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
      items: [
        {
          name: `Gói ${planSpec.name} (1 tháng)`,
          quantity: 1,
          price: planSpec.priceVnd,
        },
      ],
    });

    // ── (5) Update checkout_url ──
    await admin
      .from("payment_orders")
      .update({ checkout_url: result.checkoutUrl })
      .eq("payos_order_code", orderCode);

    return {
      success: true,
      data: {
        checkoutUrl: result.checkoutUrl,
        orderCode,
        amount: planSpec.priceVnd,
      },
    };
  } catch (e) {
    return err(e);
  }
}
