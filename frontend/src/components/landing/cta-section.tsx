import { Clock, Lightbulb, Sparkles } from "lucide-react";

import { ACCENT } from "./_accent";
import FeedbackForm from "./feedback-form";

/**
 * Final CTA — feedback section.
 *
 * Left column: invitation copy + suggestion chips + a small "what happens
 * after you send" reassurance card. Right column: real submittable form
 * (FeedbackForm) that emails the project owner via a Server Action.
 *
 * Sizes are tuned so the two columns end at roughly the same height on
 * lg+ viewports — no big white gap on either side.
 */
export default function CTASection() {
  const A = ACCENT;
  return (
    <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-10">
      {/* Outer wrapper: holds the section bg + ring shadow. The shadow is a
          stack of (1) wide soft accent glow + (2) thin accent tint ring +
          (3) sharp slate border for definition. */}
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-5 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16"
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

        <div className="relative grid grid-cols-1 items-stretch gap-8 lg:grid-cols-[minmax(0,_1.05fr)_minmax(0,_1fr)] lg:gap-12">
          {/* ── Cột trái — invitation + chips + reassurance card ────── */}
          <div className="flex flex-col">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-medium shadow-sm"
              style={{ borderColor: A.tint, color: A.solid }}
            >
              <Sparkles className="h-3 w-3" />
              Đang lắng nghe góp ý
            </span>
            <h2 className="mt-4 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[38px] lg:text-[42px]">
              Có gợi ý cải tiến?{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${A.from}, ${A.to})`,
                }}
              >
                Chúng tôi muốn nghe.
              </span>
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-slate-600 sm:text-[15px]">
              Sản phẩm đang trong giai đoạn dùng thử. Mỗi góp ý từ trung tâm
              và trường học giúp chúng tôi biết nên ưu tiên xây gì tiếp theo.
            </p>

            {/* Chips — gợi ý các loại góp ý thường gặp. Vừa lấp khoảng
                trống vừa "mồi" cho người đọc biết nên viết gì. */}
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {[
                "Tính năng còn thiếu",
                "Lỗi khi sử dụng",
                "Quy trình chưa mượt",
                "Ý tưởng mới",
                "Trải nghiệm trên điện thoại",
              ].map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-medium text-slate-600"
                >
                  {t}
                </li>
              ))}
            </ul>

            {/* Reassurance cards — 2 ô nhỏ ngang ngang, cho biết điều
                gì xảy ra sau khi bấm Gửi. */}
            <div className="mt-auto grid grid-cols-1 gap-2 pt-6 sm:grid-cols-2">
              <Reassurance
                icon={<Clock className="h-3.5 w-3.5" />}
                title="Phản hồi trong 1–2 ngày"
                body="Trong giờ hành chính, T2 – T7."
                accent={A.solid}
                tint={A.tint}
              />
              <Reassurance
                icon={<Lightbulb className="h-3.5 w-3.5" />}
                title="Mọi góp ý đều được đọc"
                body="Chúng tôi tổng hợp + ưu tiên hàng tuần."
                accent={A.solid}
                tint={A.tint}
              />
            </div>
          </div>

          {/* ── Cột phải — form gửi góp ý thật ────────────────────── */}
          <FeedbackForm />
        </div>
      </div>
    </section>
  );
}

// ── Reassurance ─────────────────────────────────────────────────────────────
// Mini-card 2 ô dùng để lấp phần dưới cột trái, đồng thời cho người dùng
// biết điều gì xảy ra sau khi gửi → tăng tỷ lệ thật sự bấm gửi.
function Reassurance({
  icon,
  title,
  body,
  accent,
  tint,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <span
          className="grid h-5 w-5 place-items-center rounded-md"
          style={{ background: tint, color: accent }}
        >
          {icon}
        </span>
        <p className="text-[12.5px] font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{body}</p>
    </div>
  );
}
