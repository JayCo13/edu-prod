import "server-only";

import { PayOS } from "@payos/node";

/**
 * PayOS SDK wrapper.
 *
 * SDK đọc trực tiếp các biến PAYOS_CLIENT_ID / PAYOS_API_KEY /
 * PAYOS_CHECKSUM_KEY từ process.env nếu không truyền trực tiếp khi
 * khởi tạo. `server-only` import đảm bảo file này không bao giờ
 * vào client bundle, kể cả khi vô tình bị import từ Client Component.
 *
 * Tài liệu: https://payos.vn/docs
 */

let singleton: PayOS | null = null;

export function getPayOS(): PayOS {
  if (singleton) return singleton;

  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error(
      "PayOS chưa được cấu hình. Vui lòng đặt PAYOS_CLIENT_ID, " +
        "PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong .env.local.",
    );
  }

  singleton = new PayOS({ clientId, apiKey, checksumKey });
  return singleton;
}

// ── Order code helper ─────────────────────────────────────────────────────
//
// PayOS yêu cầu `orderCode` là số nguyên duy nhất per giao dịch
// (max 9007199254740991 = 2^53 - 1). Cách an toàn:
//   • Lấy timestamp millisec (13 chữ số) + 3 chữ số random
//   • Tổng cộng 16 chữ số → còn rất xa giới hạn 2^53-1
//
// Dùng cho mọi payment_orders.payos_order_code.
export function generateOrderCode(): number {
  const ts = Date.now(); // 13 chữ số
  const rand = Math.floor(Math.random() * 1000); // 0-999
  return ts * 1000 + rand;
}
