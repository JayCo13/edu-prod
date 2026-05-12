import { Quote, Star } from "lucide-react";
import { ACCENT } from "./_accent";

export default function Testimonial() {
  return (
    <section className="border-y border-slate-100 bg-[#f5f5f5] py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-10 sm:grid-cols-[auto_minmax(0,_1fr)] sm:gap-14">
          <div className="relative">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-200 to-rose-200 sm:h-40 sm:w-40">
              <span className="font-display text-[42px] font-bold text-rose-900/40">
                TH
              </span>
            </div>
            <div
              className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-xl text-white shadow-lg"
              style={{ background: ACCENT.solid }}
            >
              <Quote className="h-4 w-4" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="flex gap-0.5 text-amber-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4" fill="currentColor" />
              ))}
            </div>
            <p className="font-display mt-3 text-[22px] font-semibold leading-snug text-slate-900 sm:text-[26px]">
              &ldquo;Trong 3 tháng đầu chuyển sang VLearning, doanh thu tăng{" "}
              <span style={{ color: ACCENT.solid }}>2.4 lần</span> mà tôi không
              phải lo về kỹ thuật. Học viên trải nghiệm mượt — và quan trọng
              nhất, họ thấy thương hiệu của <em>tôi</em>, không phải nền
              tảng.&rdquo;
            </p>
            <div className="mt-5 flex items-center gap-3 text-[13px]">
              <div>
                <p className="font-semibold text-slate-900">Cô Trần Thị Hương</p>
                <p className="text-slate-500">
                  Giáo viên Toán THPT · 28k học viên · luyenthi-toan.vn
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
