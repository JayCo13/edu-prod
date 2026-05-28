import Link from "next/link";
import { ArrowRight, Send, Sparkles } from "lucide-react";

import { ACCENT } from "./_accent";

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
              Đang nhận trung tâm dùng thử
            </span>
            <h2 className="mt-5 font-display text-[36px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[48px]">
              Bảng lương tự động — <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${A.from}, ${A.to})`,
                }}
              >
                đúng giờ, đúng số.
              </span>
            </h2>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-slate-600">
              Demo 15 phút trên Google Meet. Chúng tôi đi qua lịch dạy, bảng
              lương và thời khoá biểu — với danh sách giáo viên thật của trung
              tâm bạn.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="#demo"
                className="group inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: A.solid,
                  boxShadow: `0 12px 30px -8px ${A.shadow}`,
                }}
              >
                Đặt lịch demo 15 phút
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="mailto:hello@vlearning.io"
                className="font-mono text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                Hoặc email hello@vlearning.io →
              </a>
            </div>
          </div>

          {/* Demo form preview — light bg with accent ring shadow. */}
          <div className="relative hidden lg:block">
            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-5"
              style={{
                boxShadow: `0 12px 30px -10px ${A.shadow}, 0 0 0 1px ${A.tint}`,
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="font-mono text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: A.solid }}
                >
                  · Đặt lịch demo
                </p>
                <span className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
                  Bản xem trước
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { l: "Tên bạn", v: "Nguyễn Văn A" },
                  { l: "Trung tâm", v: "Trung tâm ABC" },
                  { l: "Số giáo viên", v: "10 – 20" },
                  { l: "Điện thoại Zalo", v: "09xx xxx xxx" },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200/60 bg-slate-50/60 px-3 py-2"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
                      {f.l}
                    </p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-slate-600">
                      {f.v}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.01]"
                style={{
                  background: A.solid,
                  boxShadow: `0 6px 16px -4px ${A.shadow}`,
                }}
              >
                Gửi
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-3 text-center font-mono text-[10px] text-slate-400">
              Chúng tôi đọc email trong giờ hành chính (8h – 18h, T2 – T7).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
