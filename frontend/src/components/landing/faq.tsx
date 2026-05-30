"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { ACCENT } from "./_accent";

/**
 * FAQ — 6 questions a center owner usually asks.
 * Ported from the design bundle.
 */

const ITEMS = [
  {
    q: "Trung tâm và trường học khác nhau dùng Edura thế nào?",
    a:
      "Khi đăng ký, bạn chọn loại tài khoản: Trung tâm dạy thêm sẽ thấy Lịch dạy + Bảng lương + Khóa học; Trường học sẽ thấy Thời khoá biểu cả khối + Quản lý lớp + Môn + Tiết. Phần Giáo viên và Cài đặt thì cả hai loại đều có. Bạn có thể đổi loại sau nếu cần.",
  },
  {
    q: "Dữ liệu của trung tâm / trường có an toàn không?",
    a:
      "Dữ liệu lưu trên Supabase Cloud với Row-Level Security theo từng tài khoản — không tổ chức nào đọc được dữ liệu của tổ chức khác. Mật khẩu lưu bằng bcrypt, mọi đường truyền đều HTTPS. Chúng tôi không bán hoặc chia sẻ dữ liệu cho bên thứ ba. Bạn có thể xuất file Excel toàn bộ dữ liệu bất cứ lúc nào để sao lưu.",
  },
  {
    q: "Đang dùng Excel — chuyển sang Edura có khó không?",
    a:
      "Có file Excel mẫu để bạn dán danh sách giáo viên, lớp, môn vào rồi upload là xong. Nếu cần hỗ trợ chuyển dữ liệu cụ thể, gửi email — chúng tôi sẽ giúp trong giai đoạn dùng thử.",
  },
  {
    q: "Có cần cài server hay phần mềm gì không?",
    a:
      "Không. Edura chạy trên trình duyệt — máy tính hay điện thoại đều mở được. Không cần đội IT, không cần cài ứng dụng, không cần cập nhật phần mềm.",
  },
  {
    q: "Giáo viên có phải tải ứng dụng riêng không?",
    a:
      "Không. Giáo viên đăng nhập trên điện thoại (Safari / Chrome) để xem lịch và xác nhận buổi dạy. Không qua App Store hay Play Store.",
  },
  {
    q: "Sau khi hết giai đoạn dùng thử, phí tính thế nào?",
    a:
      "Dự kiến tính theo số giáo viên hoạt động trong tháng (có ít nhất 1 buổi dạy đối với trung tâm, hoặc 1 tiết được xếp đối với trường). Slot không dùng = không tính phí. Chúng tôi sẽ thông báo trước ít nhất 30 ngày trước khi áp dụng phí, để bạn có thời gian cân nhắc.",
  },
  {
    q: "Sản phẩm đã ổn định chưa?",
    a:
      "Đang trong giai đoạn dùng thử. Các tính năng chính (lịch dạy, bảng lương, thời khoá biểu, quản lý giáo viên) đã chạy thật nhưng vẫn được cải tiến hàng tuần dựa trên góp ý của các tổ chức dùng thử. Nếu bạn cần một sản phẩm đã hoàn toàn ổn định, có thể quay lại sau vài tháng.",
  },
];

export default function FAQ() {
  const A = ACCENT;
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <p
          className="text-center font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
          style={{ color: A.solid }}
        >
          · CÂU HỎI THƯỜNG GẶP
        </p>
        <h2 className="mt-3 text-center font-display text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[40px]">
          Vài điều bạn có thể đang thắc mắc.
        </h2>

        <div className="mt-10 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          {ITEMS.map((it, i) => {
            const on = i === open;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(on ? -1 : i)}
                className="block w-full px-5 py-5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display text-[15.5px] font-semibold text-slate-900">
                      {it.q}
                    </h3>
                    {on && (
                      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                        {it.a}
                      </p>
                    )}
                  </div>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                    {on ? (
                      <Minus className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <Plus className="h-3 w-3" strokeWidth={2} />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
