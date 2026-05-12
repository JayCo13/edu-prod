import { ArrowRight, Sparkles, Star } from "lucide-react";
import { ACCENT } from "./_accent";

const TESTIMONIALS = [
  {
    name: "Cô Hương",
    role: "Toán THPT",
    quote: "Doanh thu tăng 2.4× trong 3 tháng.",
    rotate: "-3deg",
    offset: "0px",
  },
  {
    name: "Thầy Minh",
    role: "IELTS Speaking",
    quote: "Học viên nói trải nghiệm mượt như Coursera.",
    rotate: "2deg",
    offset: "60px",
  },
  {
    name: "Cô Lan",
    role: "Hoá học 12",
    quote: "Setup chỉ mất 4 phút. Khó tin nhưng thật.",
    rotate: "-1deg",
    offset: "120px",
  },
];

export default function CTASection() {
  return (
    <section className="bg-white px-6 py-24 sm:py-28 lg:px-10">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-slate-950 px-8 py-16 sm:px-14 sm:py-20">
        {/* Glow blobs */}
        <div
          className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: ACCENT.solid }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{ background: ACCENT.from }}
        />
        {/* Dot grid */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
          aria-hidden
        >
          <defs>
            <pattern
              id="cta-dots"
              width="22"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-dots)" />
        </svg>

        <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-200 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" /> 14 ngày dùng thử Pro miễn phí
            </span>
            <h2 className="font-display mt-5 text-[36px] font-bold leading-[1.05] tracking-tight text-white sm:text-[48px]">
              Sẵn sàng xây dựng đế chế <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${ACCENT.from}, ${ACCENT.to})`,
                }}
              >
                học trực tuyến
              </span>{" "}
              của bạn?
            </h2>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-slate-300">
              Tham gia cùng 1,247 giáo viên đang dạy trên VLearning. Setup
              trong 5 phút, không cần thẻ tín dụng, không cam kết dài hạn.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* [DEPRECATED per PRD §4.3] - hidden 2026-05-12
                  Teacher self-signup CTA. PRD §8.1: replace with demo-booking CTA for center owners.
              <a
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-slate-900 transition-transform hover:scale-[1.02]"
              >
                Tạo tài khoản miễn phí
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              */}
              <a
                href="mailto:hello@vlearning.io"
                className="text-[14px] font-medium text-slate-300 transition-colors hover:text-white"
              >
                Hoặc liên hệ tư vấn →
              </a>
            </div>
          </div>

          {/* Stacked testimonial cards */}
          <div className="relative hidden lg:block">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="absolute left-0 right-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
                style={{ transform: `rotate(${t.rotate})`, top: t.offset }}
              >
                <div className="flex gap-0.5 text-amber-300">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} className="h-3 w-3" fill="currentColor" />
                  ))}
                </div>
                <p className="mt-2 text-[13px] font-medium text-white">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-2 text-[11px] text-slate-300">
                  {t.name} · {t.role}
                </p>
              </div>
            ))}
            <div className="invisible h-64" />
          </div>
        </div>
      </div>
    </section>
  );
}
