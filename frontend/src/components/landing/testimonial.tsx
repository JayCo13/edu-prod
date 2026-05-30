import { Quote, Star } from "lucide-react";

import { ACCENT } from "./_accent";

/**
 * Testimonial — single quote from a center owner.
 * Ported from the design bundle.
 *
 * Replace the placeholder text + avatar initials with a real customer
 * before shipping; the gradient block holds the initials in lieu of a photo.
 */
export default function Testimonial() {
  const A = ACCENT;
  return (
    <section className="border-y border-slate-100 bg-[#f5f5f5] py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-10 sm:grid-cols-[auto_minmax(0,_1fr)] sm:gap-14">
          <div className="relative">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-200 to-violet-200 sm:h-40 sm:w-40">
              <span className="font-display text-[42px] font-bold text-indigo-900/40">
                NM
              </span>
            </div>
            <div
              className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-xl text-white shadow-lg"
              style={{ background: A.solid }}
            >
              <Quote className="h-4 w-4" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="flex gap-0.5 text-amber-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-3 font-display text-[22px] font-semibold leading-snug text-slate-900 sm:text-[26px]">
              &ldquo;Trước đây cuối tháng tôi mất{" "}
              <span style={{ color: A.solid }}>2 ngày</span> ngồi xếp Excel cho
              24 giáo viên — sai số liên tục. Chuyển sang Edura, mất đúng{" "}
              <span style={{ color: A.solid }}>15 phút</span> bấm Chốt lương,
              xuất Excel chuẩn ngân hàng. Cô kế toán không còn cằn nhằn.&rdquo;
            </p>
            <div className="mt-5 text-[13px]">
              <p className="font-semibold text-slate-900">
                Anh Nguyễn Văn Nam
              </p>
              <p className="text-slate-500">
                Giám đốc · Trung tâm Anh ngữ ABC · Hà Nội · 24 giáo viên
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
