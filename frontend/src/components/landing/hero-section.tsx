"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Check,
  TrendingUp,
  Landmark,
  Users,
} from "lucide-react";
import { ACCENT } from "./_accent";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pb-10 pt-14 sm:pt-20">
      {/* Layered backdrop: radial tint + faint grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <div
          className="absolute inset-x-0 top-0 h-[680px] opacity-70"
          style={{
            background: `radial-gradient(60% 60% at 50% 0%, ${ACCENT.tint} 0%, transparent 60%)`,
          }}
        />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.35]"
          aria-hidden
        >
          <defs>
            <pattern
              id="hero-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="rgb(15 23 42 / 0.05)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="hero-fade" cx="50%" cy="0%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
          <rect width="100%" height="100%" fill="url(#hero-fade)" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,_1.05fr)_minmax(0,_1fr)]">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 shadow-[0_1px_0_0_rgb(15_23_42/0.04)]">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full"
                  style={{ background: ACCENT.solid, opacity: 0.6 }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: ACCENT.solid }}
                />
              </span>
              Đã có 1,247 giáo viên đang giảng dạy
            </span>

            <h1 className="font-display mt-6 text-[44px] leading-[1.04] tracking-tight text-slate-900 sm:text-[56px] lg:text-[64px]">
              Bệ phóng độc lập cho{" "}
              <span className="relative whitespace-nowrap">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${ACCENT.from}, ${ACCENT.to})`,
                  }}
                >
                  sự nghiệp
                </span>
                <svg
                  className="absolute -bottom-2 left-0 h-3 w-full"
                  viewBox="0 0 220 12"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M2 8 C 60 1, 160 1, 218 7"
                    fill="none"
                    stroke={ACCENT.solid}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              giảng dạy
            </h1>

            <p className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-slate-600">
              Tạo website khóa học mang tên miền của riêng bạn, bán video VOD
              bảo mật, tổ chức lớp live qua Zoom — VLearning lo phần kỹ thuật,
              bạn chỉ cần dạy.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <motion.a
                href="/register"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-semibold text-white"
                style={{
                  background: ACCENT.solid,
                  boxShadow: `0 10px 30px -8px ${ACCENT.shadow}`,
                }}
              >
                Bắt đầu miễn phí — không cần thẻ
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </motion.a>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[14px] font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <Play className="h-3.5 w-3.5" fill="currentColor" />
                Xem demo 90 giây
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-[12.5px] text-slate-500">
              {[
                "14 ngày dùng thử Pro",
                "Setup trong 5 phút",
                "Hỗ trợ 24/7",
              ].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.15, ease: "easeOut" }}
    >
      {/* Floating chip — left */}
      <div className="absolute -left-3 top-12 z-20 hidden rotate-[-3deg] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5 sm:block">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-emerald-600"
            style={{ background: "rgb(16 185 129 / 0.1)" }}
          >
            <Landmark className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Doanh thu hôm nay
            </p>
            <p className="font-display text-[15px] font-bold text-slate-900">
              +₫4,820,000
            </p>
          </div>
        </div>
      </div>

      {/* Floating chip — right */}
      <div className="absolute -right-2 bottom-16 z-20 hidden rotate-[2deg] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5 sm:block">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: ACCENT.tint, color: ACCENT.solid }}
          >
            <Users className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Học viên đang xem
            </p>
            <p className="font-display text-[15px] font-bold text-slate-900">
              218 online
            </p>
          </div>
        </div>
      </div>

      <div className="relative rounded-[22px] bg-gradient-to-br from-slate-100 to-slate-200 p-1.5 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/10">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 rounded-t-[16px] bg-slate-50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-[11px] text-slate-500">
            <span className="text-slate-400">https://</span>
            thaytoan.vlearning.io
            <span className="text-slate-400">/dashboard</span>
          </div>
          <span className="hidden rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700 sm:inline">
            SSL
          </span>
        </div>

        {/* App body */}
        <div className="grid grid-cols-12 rounded-b-[16px] bg-white">
          {/* Sidebar */}
          <aside className="col-span-3 hidden border-r border-slate-100 bg-slate-50/50 p-3 sm:block">
            <div className="flex items-center gap-2 px-2 py-2">
              <span
                className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold text-white"
                style={{ background: ACCENT.solid }}
              >
                T
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-900">
                  Thầy Toán Lý Hoá
                </p>
                <p className="truncate text-[9.5px] text-slate-400">
                  thaytoan.vlearning.io
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              {(
                [
                  ["Bảng điều khiển", true],
                  ["Khóa học", false],
                  ["Học viên", false],
                  ["Lịch live", false],
                  ["Doanh thu", false],
                  ["Cài đặt", false],
                ] as Array<[string, boolean]>
              ).map(([l, on]) => (
                <div
                  key={l}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                    on ? "font-semibold" : "text-slate-500"
                  }`}
                  style={
                    on
                      ? { background: ACCENT.tint, color: ACCENT.solid }
                      : undefined
                  }
                >
                  <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                  {l}
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <main className="col-span-12 p-4 sm:col-span-9 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Tổng quan tháng 5
                </p>
                <h3 className="font-display text-[18px] font-bold text-slate-900">
                  Chào buổi sáng, Toàn 👋
                </h3>
              </div>
              <div className="hidden gap-1.5 sm:flex">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                  7 ngày
                </span>
                <span
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-white"
                  style={{ background: ACCENT.solid }}
                >
                  30 ngày
                </span>
              </div>
            </div>

            {/* KPI cards */}
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[
                { label: "Doanh thu", value: "₫84.2M", delta: "+18%", color: ACCENT.solid },
                { label: "Học viên mới", value: "412", delta: "+24%", color: "#10b981" },
                { label: "Hoàn thành", value: "92%", delta: "+3%", color: "#f59e0b" },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-slate-100 bg-white p-3"
                >
                  <p className="text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                    {k.label}
                  </p>
                  <p className="font-display mt-1 text-[18px] font-bold tabular-nums text-slate-900">
                    {k.value}
                  </p>
                  <p
                    className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold"
                    style={{ color: k.color }}
                  >
                    <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />{" "}
                    {k.delta}
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-700">
                  Doanh thu 30 ngày
                </p>
                <span className="font-mono text-[10px] text-slate-400">
                  ₫ · VND
                </span>
              </div>
              <svg viewBox="0 0 320 80" className="mt-2 h-20 w-full">
                <defs>
                  <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT.solid} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={ACCENT.solid} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 60 L20 55 L40 50 L60 52 L80 42 L100 38 L120 45 L140 30 L160 33 L180 22 L200 28 L220 18 L240 24 L260 14 L280 20 L300 8 L320 12 L320 80 L0 80 Z"
                  fill="url(#hero-area)"
                />
                <path
                  d="M0 60 L20 55 L40 50 L60 52 L80 42 L100 38 L120 45 L140 30 L160 33 L180 22 L200 28 L220 18 L240 24 L260 14 L280 20 L300 8 L320 12"
                  fill="none"
                  stroke={ACCENT.solid}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="300"
                  cy="8"
                  r="3"
                  fill="white"
                  stroke={ACCENT.solid}
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Live row */}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                  Lớp live tiếp theo
                </p>
                <p className="mt-1 text-[12px] font-semibold text-slate-900">
                  Hình học không gian — 12.B
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-rose-500" />{" "}
                    19:30
                  </span>
                  <span>·</span>
                  <span>47 đăng ký</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
                  Khóa bán chạy
                </p>
                <p className="mt-1 text-[12px] font-semibold text-slate-900">
                  Toán 12 — Luyện thi THPT
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {["#fda4af", "#fcd34d", "#a7f3d0", "#bfdbfe"].map((c) => (
                      <span
                        key={c}
                        className="h-4 w-4 rounded-full border border-white"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    +218 học viên tuần này
                  </span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </motion.div>
  );
}
