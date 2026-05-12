"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { ACCENT } from "./_accent";

const ITEMS = [
  {
    q: "Tôi có cần biết kỹ thuật để dùng VLearning không?",
    a: "Hoàn toàn không. Bạn chỉ cần kéo-thả video, gõ nội dung khóa học và nhấn xuất bản. Toàn bộ phần encode, CDN, SSL, bảo mật được xử lý tự động.",
  },
  {
    q: "Phí giao dịch tính như thế nào?",
    a: "Gói Starter: 8% mỗi đơn hàng. Gói Pro: 5% mỗi đơn — không có phí ẩn, không có phí setup, không có phí duy trì hàng tháng cho gói Starter.",
  },
  {
    q: "Tôi có thể dùng tên miền riêng không?",
    a: "Có. Gói Pro hỗ trợ gắn tên miền của bạn (vd: thaytoan.vn) cùng với SSL được cấp tự động. Học viên sẽ chỉ thấy thương hiệu của bạn.",
  },
  {
    q: "Khi nào tôi nhận được tiền?",
    a: "Tiền sẽ được chuyển về tài khoản ngân hàng hoặc PayPal của bạn theo lịch T+2 (2 ngày làm việc) sau khi học viên thanh toán thành công.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <p
          className="text-center font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
          style={{ color: ACCENT.solid }}
        >
          · 04 — Câu hỏi thường gặp
        </p>
        <h2 className="font-display mt-3 text-center text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[40px]">
          Bạn còn thắc mắc?
        </h2>

        <div className="mt-10 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          {ITEMS.map((it, i) => {
            const on = i === open;
            return (
              <button
                key={it.q}
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
                      <Minus className="h-3 w-3" strokeWidth={2.5} />
                    ) : (
                      <Plus className="h-3 w-3" strokeWidth={2.5} />
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
