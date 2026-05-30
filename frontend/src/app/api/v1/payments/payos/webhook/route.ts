import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPayOS } from "@/lib/payos/client";

/**
 * PayOS webhook receiver.
 *
 * PayOS gọi POST tới endpoint này mỗi khi trạng thái giao dịch thay đổi.
 * Body kèm signature HMAC-SHA256 — SDK của họ verify thay mình qua
 * `payos.webhooks.verify()`. Nếu signature sai → trả 400 (PayOS sẽ retry
 * lại sau).
 *
 * Trạng thái khả dĩ:
 *   • code "00" + success: true  → giao dịch thành công → PAID + activate sub.
 *   • code khác / success: false → thất bại → FAILED.
 *
 * Đường này cần là PUBLIC (PayOS gọi từ ngoài, không có session). Bảo vệ
 * bằng signature, không bằng auth Supabase.
 *
 * Đăng ký URL này ở PayOS Dashboard → Cài đặt → Webhook URL:
 *   https://<your-domain>/api/v1/payments/payos/webhook
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body không phải JSON hợp lệ." },
      { status: 400 },
    );
  }

  // ── Verify signature ──
  const payos = getPayOS();
  let verified;
  try {
    // SDK accepts `Webhook` shape — toàn bộ payload kèm signature.
    // Throws nếu signature không khớp.
    verified = await payos.webhooks.verify(
      body as Parameters<typeof payos.webhooks.verify>[0],
    );
  } catch (e) {
    console.warn("[PayOS webhook] signature verify failed:", e);
    return NextResponse.json(
      { error: "Signature không hợp lệ." },
      { status: 400 },
    );
  }

  const orderCode = verified.orderCode;
  const succeeded = verified.code === "00";

  const admin = createAdminClient();

  // ── Tìm payment_orders tương ứng ──
  const { data: order, error: orderErr } = await admin
    .from("payment_orders")
    .select("id, tenant_id, subscription_id, status")
    .eq("payos_order_code", orderCode)
    .maybeSingle();

  if (orderErr || !order) {
    // Order không tồn tại — có thể giao dịch test cũ. Vẫn trả 200 để
    // PayOS không retry vô tận, log để debug.
    console.warn(
      "[PayOS webhook] order not found for orderCode:",
      orderCode,
      orderErr?.message,
    );
    return NextResponse.json({ received: true });
  }

  // Idempotency — nếu đã PAID trước đó thì bỏ qua.
  if (order.status === "PAID") {
    return NextResponse.json({ received: true, already: true });
  }

  // ── Update payment_orders ──
  const newStatus = succeeded ? "PAID" : "FAILED";
  const updates: Record<string, unknown> = {
    status: newStatus,
    webhook_payload: verified as unknown as Record<string, unknown>,
  };
  if (succeeded) updates.paid_at = new Date().toISOString();

  const { error: updateErr } = await admin
    .from("payment_orders")
    .update(updates)
    .eq("id", order.id);
  if (updateErr) {
    console.error("[PayOS webhook] failed to update order:", updateErr);
    // Trả 500 để PayOS retry, tránh mất giao dịch.
    return NextResponse.json(
      { error: "Lưu trạng thái thất bại." },
      { status: 500 },
    );
  }

  // ── Activate subscription ──
  if (succeeded) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: subErr } = await admin
      .from("subscriptions")
      .update({
        status: "ACTIVE",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", order.subscription_id);
    if (subErr) {
      console.error(
        "[PayOS webhook] failed to activate subscription:",
        subErr,
      );
      // Order đã PAID, đã ghi nhận tiền — không return 500 ở đây.
      // Sẽ cần migration / hỗ trợ thủ công nếu rơi vào case này.
    }
  }

  return NextResponse.json({ received: true });
}

// PayOS đôi khi gọi GET để xác minh endpoint sống — trả 200 cho mọi GET.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
