import { Sparkles } from "lucide-react";

import { ACCENT } from "./_accent";
import FeedbackForm from "./feedback-form";

/**
 * Final CTA — light-card variant with layered "premium" effects.
 *
 * The previous version was a dark-gradient block. User wanted a white card
 * but with effect. Approach: solid white card, accent-tinted ring shadow,
 * two corner aurora radials, a faint dot grid, and an internal mockup of the
 * demo form. Form is illustrative — submit currently does nothing.
 */
export default function CTASection() {
  const A = ACCENT;
  return (
    <section className="bg-white px-6 py-24 sm:py-28 lg:px-10">
      {/* Outer wrapper: holds the section bg + ring shadow. The shadow is a
          stack of (1) wide soft accent glow + (2) thin accent tint ring +
          (3) sharp slate border for definition. */}
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-8 py-16 sm:px-14 sm:py-20"
        style={{
          boxShadow: `0 30px 70px -20px ${A.shadow}, 0 0 0 8px ${A.tint}`,
        }}
      >
        {/* Aurora — top-right radial accent. Sits behind everything; very
            soft, mostly visible at the corner. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full opacity-[0.22] blur-3xl"
          style={{
            background: `radial-gradient(circle, ${A.from} 0%, transparent 70%)`,
          }}
        />
        {/* Aurora — bottom-left, slightly different hue for depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full opacity-[0.18] blur-3xl"
          style={{
            background: `radial-gradient(circle, ${A.to} 0%, transparent 70%)`,
          }}
        />
        {/* Faint dot grid. Lives at 0.05 opacity so it reads as texture, not
            decoration. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
        >
          <defs>
            <pattern id="cdg" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgb(15 23 42)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cdg)" />
        </svg>
        {/* Top accent line — a thin gradient stroke at the very top of the
            card, ties the card visually back to the accent hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-12 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${A.solid}, transparent)`,
          }}
        />

        <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)] lg:gap-16">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-[12px] font-medium shadow-sm"
              style={{ borderColor: A.tint, color: A.solid }}
            >
              <Sparkles className="h-3 w-3" />
              Đang lắng nghe góp ý từ trung tâm và trường học
            </span>
            <h2 className="mt-5 font-display text-[36px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[48px]">
              Có gợi ý cải tiến? <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${A.from}, ${A.to})`,
                }}
              >
                Chúng tôi muốn nghe.
              </span>
            </h2>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-slate-600">
              Sản phẩm đang trong giai đoạn dùng thử. Mỗi góp ý từ trung tâm và
              trường học — kể về chỗ rối, tính năng còn thiếu, hoặc đơn giản
              là điều bạn thích — giúp chúng tôi biết nên ưu tiên xây gì tiếp
              theo.
            </p>
          </div>

          {/* Form gửi góp ý — submit qua Server Action, nội dung gửi thẳng
              tới hộp thư người vận hành. Không có địa chỉ email nào lộ ra
              trên DOM phía client. */}
          <FeedbackForm />
        </div>
      </div>
    </section>
  );
}
