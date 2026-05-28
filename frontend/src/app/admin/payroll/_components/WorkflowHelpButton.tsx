"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HelpCircle,
  CheckCircle2,
  Lock,
  Wallet,
  RefreshCw,
  CalendarClock,
  X,
} from "lucide-react";

/**
 * "?" button on the payroll page header. Opens a Vietnamese walkthrough of
 * the DRAFT → APPROVED → PAID lifecycle and the timing recommendation for
 * "Duyệt và khoá". Self-contained dialog (no global confirm — this is
 * informational only with a single "Đã hiểu" dismiss).
 */
export default function WorkflowHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="Hướng dẫn quy trình bảng lương"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Hướng dẫn
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 26, stiffness: 360 }}
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    Hướng dẫn
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                    Quy trình bảng lương
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    DRAFT → APPROVED → PAID, và lúc nào nên bấm gì.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700">
                <section>
                  <h3 className="text-sm font-semibold text-slate-900">
                    1. Chuẩn bị trước kỳ
                  </h3>
                  <p className="mt-1.5">
                    Vào{" "}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">
                      /dashboard/teachers
                    </span>{" "}
                    để đảm bảo mỗi giáo viên đã có <strong>Hình thức trả
                    lương</strong> và <strong>đơn giá</strong> đúng (theo
                    giờ / theo buổi / cố định / kết hợp). Nếu rate = 0 thì
                    "Cơ bản" sẽ ra 0đ.
                  </p>
                </section>

                <Step
                  icon={CalendarClock}
                  badge="DRAFT"
                  badgeClass="bg-slate-100 text-slate-700"
                  title="2. Tạo kỳ lương"
                >
                  Đầu tháng (hoặc đến ngày trả lương đã cấu hình) bấm{" "}
                  <strong>“Tạo kỳ lương mới”</strong>. Hệ thống tự nạp tất cả
                  giáo viên đang hoạt động + buổi học trong tháng và tính lương
                  cơ bản. Kỳ ở trạng thái <strong>DRAFT</strong> — vẫn sửa được.
                </Step>

                <Step
                  icon={RefreshCw}
                  badge="DRAFT"
                  badgeClass="bg-slate-100 text-slate-700"
                  title="3. Rà soát & điều chỉnh"
                >
                  Mở chi tiết kỳ → kiểm tra từng giáo viên → thêm{" "}
                  <strong>Phụ cấp / Khấu trừ</strong> nếu cần (kèm lý do).
                  Nếu vừa sửa rate trong trang Giáo viên, bấm{" "}
                  <strong>“Tính lại”</strong> để cập nhật snapshot. Điều chỉnh
                  thủ công được giữ nguyên khi tính lại.
                </Step>

                <Step
                  icon={Lock}
                  badge="APPROVED"
                  badgeClass="bg-indigo-100 text-indigo-700"
                  title="4. Duyệt và khoá"
                >
                  Khi mọi con số đã đúng, bấm <strong>“Duyệt và khoá”</strong>.
                  Snapshot bị đóng băng vĩnh viễn — không thể thêm điều chỉnh
                  hay tính lại nữa. Nếu phát hiện sai sót sau bước này, chỉ
                  có thể bù trừ ở kỳ kế.
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                    <strong>Khuyến nghị thời điểm:</strong> duyệt sát ngày trả
                    lương (1–2 ngày trước hoặc ngay sáng ngày trả lương),
                    không duyệt quá sớm. Nếu cấu hình ngày trả lương = 5, nên
                    rà soát xong ngày 3–4 rồi duyệt ngày 5.
                  </div>
                </Step>

                <Step
                  icon={Wallet}
                  badge="PAID"
                  badgeClass="bg-emerald-100 text-emerald-700"
                  title="5. Thanh toán + đánh dấu"
                >
                  Chuyển khoản thật cho từng giáo viên (qua ngân hàng / ví).
                  Sau đó bấm <strong>“Đã thanh toán”</strong> — hệ thống ghi
                  lại <span className="font-mono">paid_at</span> và khoá kỳ
                  vĩnh viễn. <strong>“Xuất Excel”</strong> dùng để in / ký /
                  đối chiếu sổ kế toán.
                </Step>

                <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Lịch trả lương tự động
                  </h3>
                  <p className="mt-1.5 text-xs leading-snug text-slate-600">
                    Trong banner "Lịch trả lương" có thể đặt ngày trong tháng
                    (1–31). Đến đúng ngày đó (hoặc sau đó), mỗi lần vào trang
                    này hệ thống sẽ tự tạo bảng lương cho tháng vừa qua nếu
                    chưa có. Không tự duyệt — admin vẫn phải xem xét và bấm
                    "Duyệt và khoá" thủ công.
                  </p>
                </section>
              </div>

              <div className="flex flex-shrink-0 justify-end border-t border-slate-100 bg-white px-6 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Step({
  icon: Icon,
  badge,
  badgeClass,
  title,
  children,
}: {
  icon: typeof Lock;
  badge: string;
  badgeClass: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
        >
          <Icon className="h-3 w-3" />
          {badge}
        </span>
      </div>
      <div className="mt-1.5 text-sm text-slate-700">{children}</div>
    </section>
  );
}
