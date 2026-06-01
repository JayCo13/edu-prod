// Compute payment status từ data hiện tại.
//
// DB lưu status raw (đã set khi insert / update), nhưng:
//   • OVERDUE chỉ flip khi due_date < today AND paid_amount < amount.
//     Background job để flip không có. Đơn giản hơn: app layer recompute
//     mỗi lần read.
//   • PAID nhận diện bằng paid_amount ≥ amount.
//   • PARTIAL khi 0 < paid_amount < amount.
//
// Hàm này dùng ở mọi điểm READ payments (dashboard alert, list page).

import type { PaymentStatus, StudentPaymentRow } from "./types";

export function computePaymentStatus(p: StudentPaymentRow, today?: Date): PaymentStatus {
  // CANCELLED tự bảo, không tự đổi.
  if (p.status === "CANCELLED") return "CANCELLED";

  const paid = Number(p.paid_amount_vnd ?? 0);
  const total = Number(p.amount_vnd);

  if (paid >= total) return "PAID";

  const now = today ?? new Date();
  const due = new Date(p.due_date + "T00:00:00");
  const overdue = now > due;

  if (paid > 0) {
    // Đã đóng một phần, trễ hạn vẫn highlight OVERDUE để admin xử lý.
    return overdue ? "OVERDUE" : "PARTIAL";
  }
  return overdue ? "OVERDUE" : "PENDING";
}

// Trả về số ngày tính từ today → due (dương = còn N ngày, âm = quá N ngày).
export function daysUntilDue(dueDate: string, today?: Date): number {
  const now = today ?? new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate + "T00:00:00");
  const ms = due.getTime() - todayMid.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function remainingVnd(p: StudentPaymentRow): number {
  return Math.max(0, Number(p.amount_vnd) - Number(p.paid_amount_vnd ?? 0));
}
