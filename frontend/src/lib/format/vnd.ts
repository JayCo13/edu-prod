// Tiện ích định dạng VND cho input + display.
//
// Format đầu vào: user gõ vào ô số tiền → strip non-digit, chèn dấu chấm
// mỗi 3 chữ số theo chuẩn VN ("1.500.000"). KHÔNG thêm "đ" trong input
// để dễ edit; suffix đ chỉ dùng khi render read-only.

/**
 * Lọc chỉ chữ số + chèn dấu chấm phân nhóm hàng nghìn.
 * "1500000abc" → "1.500.000"
 * ""           → ""
 */
export function formatVndDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Lấy số nguyên đồng từ chuỗi đã format (hoặc input thô).
 * "1.500.000" → 1500000
 * ""          → 0
 */
export function parseVndDigits(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * Format số → chuỗi VND có đơn vị "đ" (cho display read-only).
 * 1500000 → "1.500.000đ"
 */
export function formatVnd(n: number | null | undefined): string {
  if (n == null) return "0đ";
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
