"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  FileSpreadsheet,
  Play,
  TrendingUp,
} from "lucide-react";

import { ACCENT } from "./_accent";

/**
 * Hero — first thing a center owner sees.
 *
 * Ported from the design bundle's landing-sections.jsx (Hero + HeroVisual).
 * Visual mirrors a real admin dashboard: sidebar, KPI cards, today's
 * timeline, and tasks/finance panels — gives a 2-second "yes, this is
 * software for me" signal before the user reads anything.
 *
 * Two floating chips on top: monthly payroll total + this-week schedule
 * count. Both are illustrative, not real data — landing-page content.
 */
export default function HeroSection() {
  const A = ACCENT;
  const [ref, seen] = useInView();

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-white pb-10 pt-14 sm:pt-20"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 h-[680px] opacity-70"
          style={{
            background: `radial-gradient(60% 60% at 50% 0%, ${A.tint} 0%, transparent 60%)`,
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.35]">
          <defs>
            <pattern id="hg" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="rgb(15 23 42 / 0.05)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="hf" cx="50%" cy="0%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#hg)" />
          <rect width="100%" height="100%" fill="url(#hf)" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,_1.05fr)_minmax(0,_1fr)]">
          <div
            className={`${
              seen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            } transition-all duration-700`}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 shadow-[0_1px_0_0_rgb(15_23_42/0.04)]">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: A.solid }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: A.solid }}
                />
              </span>
              Đang nhận trung tâm và trường học dùng thử
            </span>

            {/* leading-[1.18] (not 1.04 as the original design used) so the
                hand-drawn SVG underline below the gradient word has vertical
                room and never crashes into the next text line. The original
                "Cuối tháng đỡ ngồi Excel tính lương." worked at 1.04 by luck
                of where the line break happened. */}
            <h1 className="mt-6 font-display text-[44px] leading-[1.18] tracking-tight text-slate-900 sm:text-[56px] lg:text-[60px]">
              Quản lý{" "}
              <span className="relative whitespace-nowrap">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${A.from}, ${A.to})`,
                  }}
                >
                  trung tâm
                </span>
                <svg
                  className="absolute -bottom-1 left-0 h-2.5 w-full"
                  viewBox="0 0 220 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8 C 60 1, 160 1, 218 7"
                    fill="none"
                    stroke={A.solid}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              và trường học, gọn trong một nền tảng.
            </h1>

            <p className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Trung tâm dạy thêm</span>{" "}
              dùng để tính lương theo buổi đã dạy và xuất file Excel cho kế
              toán.{" "}
              <span className="font-semibold text-slate-800">Trường học</span>{" "}
              dùng để xếp thời khoá biểu cả khối trong một bảng, in hoặc chia
              sẻ mã QR cho học sinh.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="#demo"
                className="group inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: A.solid,
                  boxShadow: `0 10px 30px -8px ${A.shadow}`,
                }}
              >
                Đặt lịch demo 15 phút
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[14px] font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <Play className="h-3.5 w-3.5" />
                Xem ảnh chụp dashboard
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-[12.5px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Không hợp đồng dài hạn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Dữ liệu xuất Excel bất cứ lúc nào
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Hỗ trợ bằng tiếng Việt
              </span>
            </div>
          </div>

          <HeroVisual A={A} seen={seen} />
        </div>
      </div>
    </section>
  );
}

// ── Visual: floating chips + browser-chrome dashboard preview ──────────

function HeroVisual({ A, seen }: { A: typeof ACCENT; seen: boolean }) {
  return (
    <div
      className={`relative ${
        seen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } transition-all delay-150 duration-1000`}
    >
      {/* Floating chip — Payroll (top-left). Pushed far outside the dashboard
          frame so it doesn't overlap the sidebar header. The hero section sets
          overflow-hidden, so any horizontal overflow at narrow viewports clips
          cleanly. */}
      <div className="absolute -left-24 -top-6 z-20 hidden rotate-[-3deg] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5 lg:block">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-emerald-600"
            style={{ background: "rgb(16 185 129 / 0.1)" }}
          >
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Bảng lương tháng 4
            </p>
            <p className="font-display text-[15px] font-bold tabular-nums text-slate-900">
              184.250.000
              <span className="ml-0.5 font-display text-[12px] font-semibold text-slate-500">
                ₫
              </span>
            </p>
            <p className="mt-0.5 font-mono text-[9.5px] text-slate-400">
              18 GV · sẵn sàng xuất Excel
            </p>
          </div>
        </div>
      </div>

      {/* Floating chip — Schedule (bottom-right). Same far-overhang treatment. */}
      <div className="absolute -right-24 -bottom-6 z-20 hidden rotate-[2deg] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5 lg:block">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: A.tint, color: A.solid }}
          >
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Lịch tuần này
            </p>
            <p className="font-display text-[15px] font-bold tabular-nums text-slate-900">
              127 buổi
            </p>
            <p className="mt-0.5 font-mono text-[9.5px] text-emerald-600">
              0 trùng giờ
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard frame */}
      <div className="relative rounded-[22px] bg-gradient-to-br from-slate-100 to-slate-200 p-1.5 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/10">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 rounded-t-[16px] bg-slate-50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-[11px] text-slate-500">
            <span className="text-slate-400">vlearning.io/</span>
            admin/dashboard
          </div>
        </div>

        <div className="grid grid-cols-12 overflow-hidden rounded-b-[16px] bg-white">
          <aside className="col-span-3 hidden border-r border-slate-100 bg-slate-50/50 p-3 sm:block">
            <div className="flex items-center gap-2 px-2 py-2">
              <span
                className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold text-white"
                style={{ background: A.solid }}
              >
                A
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-900">
                  TT Anh ngữ ABC
                </p>
                <p className="truncate font-mono text-[9.5px] text-slate-400">
                  18 giáo viên
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              {(
                [
                  ["Bảng điều khiển", true],
                  ["Lịch dạy", false],
                  ["Giáo viên", false],
                  ["Bảng lương", false],
                  ["Học viên", false],
                  ["Cài đặt", false],
                ] as const
              ).map(([l, on], i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                    on ? "font-semibold" : "text-slate-500"
                  }`}
                  style={
                    on ? { background: A.tint, color: A.solid } : undefined
                  }
                >
                  <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                  {l}
                </div>
              ))}
            </div>
          </aside>

          <main className="col-span-12 p-4 sm:col-span-9 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Tổng quan · Thứ Hai, 12/05
                </p>
                <h3 className="font-display text-[18px] font-bold text-slate-900">
                  Chào buổi sáng, anh Nam 👋
                </h3>
              </div>
              <div className="hidden gap-1.5 sm:flex">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-medium text-slate-600">
                  Tuần
                </span>
                <span
                  className="rounded-md px-2 py-1 font-mono text-[10px] font-medium text-white"
                  style={{ background: A.solid }}
                >
                  Tháng
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[
                {
                  l: "Buổi học hôm nay",
                  v: "14",
                  d: "9 đang dạy",
                  c: A.solid,
                },
                {
                  l: "Giáo viên active",
                  v: "18 / 20",
                  d: "+2 tháng này",
                  c: "#10b981",
                },
                {
                  l: "Lương tháng 4",
                  v: "184M",
                  suffix: "₫",
                  d: "Đã trả 100%",
                  c: "#f59e0b",
                },
              ].map((k, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-white p-3"
                >
                  <p className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                    {k.l}
                  </p>
                  <p className="mt-1 font-display text-[18px] font-bold tabular-nums text-slate-900">
                    {k.v}
                    {k.suffix && (
                      <span className="ml-0.5 font-display text-[13px] font-semibold text-slate-500">
                        {k.suffix}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold"
                    style={{ color: k.c }}
                  >
                    <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {k.d}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-700">
                  Buổi học hôm nay · 14 buổi
                </p>
                <span className="font-mono text-[10px] text-slate-400">
                  07:00 — 21:00
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {[
                  {
                    t: "08:00",
                    n: "IELTS 6.5 · Cô Linh",
                    r: "P. A1",
                    on: false,
                  },
                  {
                    t: "10:00",
                    n: "Tiếng Anh giao tiếp · Thầy Hùng",
                    r: "P. B2",
                    on: true,
                  },
                  {
                    t: "15:00",
                    n: "Luyện thi THPT · Cô Mai",
                    r: "P. C3",
                    on: false,
                  },
                  {
                    t: "19:00",
                    n: "IELTS 7.0 · Cô Linh",
                    r: "P. B2",
                    on: false,
                  },
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-10 font-mono text-[10px] tabular-nums text-slate-400">
                      {b.t}
                    </span>
                    {/* overflow-hidden so the inner bar can never push past
                        the day's track if width + marginLeft ever sums to
                        more than 100% (was a real bug in an earlier pass). */}
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          // Constraint: width + marginLeft ≤ 100% per row.
                          //   08:00:  5% +  20% =  25%
                          //   10:00: 30% +  50% =  80%
                          //   15:00: 55% +  30% =  85%
                          //   19:00: 70% +  25% =  95%
                          width: ["20%", "50%", "30%", "25%"][i],
                          background: b.on ? "#ef4444" : A.solid,
                          marginLeft: ["5%", "30%", "55%", "70%"][i],
                        }}
                      />
                    </div>
                    {b.on && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-rose-600">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-rose-500" />
                        Đang dạy
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                  Việc cần làm
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-amber-500" />{" "}
                    Duyệt bảng lương tháng 4
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-rose-500" /> 2
                    buổi cần đổi giáo viên
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-slate-300" />{" "}
                    Mời cô Hoa vào hệ thống
                  </li>
                </ul>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-white p-3">
                <p className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                  Tài chính tháng 4
                </p>
                {/* Compact form ("184,25 tr") to fit the narrow card. The full
                    number "184.250.000 ₫" lives on the floating chip outside. */}
                <p className="mt-1 font-display text-[14px] font-bold tabular-nums text-slate-900">
                  184,25
                  <span className="ml-0.5 font-display text-[10.5px] font-semibold text-slate-500">
                    tr ₫
                  </span>
                </p>
                <p className="font-mono text-[9.5px] text-emerald-600">
                  +12% so với tháng 3
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// IntersectionObserver-based "has scrolled into view yet" — fires once,
// drives the staged fade-in. Inlined here so the landing components stay
// each self-contained.
function useInView() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && setSeen(true),
      { rootMargin: "-60px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}
