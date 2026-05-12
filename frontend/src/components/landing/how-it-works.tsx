"use client";

import { useState } from "react";
import { Upload, Check, User, Landmark } from "lucide-react";
import { ACCENT } from "./_accent";

const STEPS = [
  {
    n: "01",
    icon: User,
    title: "Tạo tài khoản & gắn tên miền",
    desc: "Đăng ký 30 giây, chọn template trang chủ, gắn tên miền của riêng bạn. SSL được cấp tự động.",
    stats: [
      ["Setup", "5 phút"],
      ["SSL", "Tự động"],
      ["Templates", "12+"],
    ] as Array<[string, string]>,
  },
  {
    n: "02",
    icon: Upload,
    title: "Upload bài giảng",
    desc: "Kéo-thả video bất kỳ định dạng — hệ thống tự encode HLS, sinh thumbnail, mã hóa bảo mật.",
    stats: [
      ["Format", "Mọi loại"],
      ["Encoding", "HLS"],
      ["DRM", "Sẵn sàng"],
    ] as Array<[string, string]>,
  },
  {
    n: "03",
    icon: Landmark,
    title: "Mở bán & nhận tiền",
    desc: "Đặt giá theo khóa hoặc theo gói tháng. Học viên thanh toán — tiền về tài khoản bạn trực tiếp.",
    stats: [
      ["Phí", "Chỉ 5%"],
      ["Thanh toán", "T+2"],
      ["Tiền tệ", "USD/VND"],
    ] as Array<[string, string]>,
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section
      id="how"
      className="border-t border-slate-100 bg-gradient-to-b from-[#f5f5f5] to-white py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ color: ACCENT.solid }}
          >
            · 03 — Cách hoạt động
          </p>
          <h2 className="font-display mt-3 text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
            Ba bước đến lớp học của bạn.
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,_5fr)_minmax(0,_6fr)] lg:gap-16">
          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`group block w-full rounded-2xl border px-5 py-5 text-left transition-all ${
                    on
                      ? "border-slate-200 bg-white shadow-[0_14px_40px_-16px_rgb(15_23_42/0.12)]"
                      : "border-transparent bg-transparent hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`font-display grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[14px] font-bold transition-colors ${
                        on ? "text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                      style={on ? { background: ACCENT.solid } : undefined}
                    >
                      {s.n}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-[16.5px] font-semibold text-slate-900">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
                        {s.desc}
                      </p>
                      {on && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {s.stats.map(([l, v]) => (
                            <span
                              key={l}
                              className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10.5px] text-slate-700"
                            >
                              <span className="text-slate-400">{l}:</span>{" "}
                              <span className="font-semibold">{v}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Visual that swaps */}
          <div className="relative">
            <div className="rounded-2xl bg-white p-7 shadow-xl shadow-slate-200/60 ring-1 ring-slate-100 sm:p-8">
              {active === 0 && <Step1Visual />}
              {active === 1 && <Step2Visual />}
              {active === 2 && <Step3Visual />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step1Visual() {
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        Cài đặt thương hiệu
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Tên miền
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="font-mono text-[12.5px] font-medium text-slate-900">
              thaytoan.vn
            </span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> SSL active
            </span>
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Logo & màu thương hiệu
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-lg text-[12px] font-bold text-white"
              style={{ background: ACCENT.solid }}
            >
              T
            </span>
            <div className="flex gap-1.5">
              {["#4f46e5", "#10b981", "#f59e0b", "#e11d48", "#0ea5e9"].map((c) => (
                <span
                  key={c}
                  className={`h-6 w-6 rounded-full ring-2 ${
                    c === ACCENT.solid
                      ? "ring-slate-900 ring-offset-1"
                      : "ring-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            Template trang chủ
          </label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`aspect-[4/3] rounded-lg border-2 ${
                  i === 0 ? "" : "border-slate-100"
                } bg-slate-50 p-1.5`}
                style={i === 0 ? { borderColor: ACCENT.solid } : undefined}
              >
                <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
                <div className="mt-1 h-6 rounded bg-slate-200/70" />
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <div className="h-3 rounded bg-slate-200/70" />
                  <div className="h-3 rounded bg-slate-200/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2Visual() {
  const files = [
    { t: "Bài 01 — Giới thiệu môn học", s: "1.2GB · 18:42", p: 100 },
    { t: "Bài 02 — Hàm số bậc 2", s: "2.4GB · 32:15", p: 100 },
    { t: "Bài 03 — Phương trình", s: "1.8GB · 24:08", p: 78 },
    { t: "Bài 04 — Bất phương trình", s: "—", p: 0 },
  ];
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        Upload nội dung
      </p>
      <div className="mt-4 space-y-2">
        {files.map((f) => {
          const inProgress = f.p > 0 && f.p < 100;
          return (
            <div
              key={f.t}
              className="rounded-xl border border-slate-100 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    f.p === 100
                      ? "bg-emerald-50 text-emerald-600"
                      : f.p === 0
                        ? "bg-slate-50 text-slate-300"
                        : ""
                  }`}
                  style={
                    inProgress
                      ? { background: ACCENT.tint, color: ACCENT.solid }
                      : undefined
                  }
                >
                  {f.p === 100 ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Upload className="h-4 w-4" strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-900">
                    {f.t}
                  </p>
                  <p className="truncate text-[10.5px] text-slate-500">{f.s}</p>
                </div>
                <span
                  className="font-mono text-[10.5px] font-semibold tabular-nums"
                  style={{
                    color:
                      f.p === 100
                        ? "#059669"
                        : f.p > 0
                          ? ACCENT.solid
                          : "#94a3b8",
                  }}
                >
                  {f.p > 0 ? `${f.p}%` : "queued"}
                </span>
              </div>
              {inProgress && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${f.p}%`, background: ACCENT.solid }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Step3Visual() {
  const courses = [
    { t: "Khóa Toán 12 — Luyện thi THPT", v: "₫14,200,000", n: 248, w: 100, c: ACCENT.solid },
    { t: "Khóa Lý 11 — Cơ bản", v: "₫6,840,000", n: 112, w: 48, c: "#10b981" },
    { t: "Lớp Live · Hình học không gian", v: "₫3,800,000", n: 47, w: 27, c: "#f59e0b" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            Doanh thu · 7 ngày qua
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="font-display text-[34px] font-bold tracking-tight tabular-nums text-slate-900">
              ₫24,840,000
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>{" "}
              +32%
            </span>
          </div>
          <p className="mt-1 font-mono text-[10.5px] text-slate-400">
            vs. tuần trước · ₫18,820,000
          </p>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-medium text-slate-600">
            7N
          </span>
          <span
            className="rounded-md px-2 py-1 font-mono text-[10px] font-medium text-white"
            style={{ background: ACCENT.solid }}
          >
            30N
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-medium text-slate-600">
            12T
          </span>
        </div>
      </div>

      <div className="mt-5">
        <svg viewBox="0 0 320 110" className="h-28 w-full">
          <defs>
            <linearGradient id="step3-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ACCENT.solid} stopOpacity="0.3" />
              <stop offset="100%" stopColor={ACCENT.solid} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              x2="320"
              y1={y}
              y2={y}
              stroke="rgb(15 23 42 / 0.05)"
              strokeDasharray="2 4"
            />
          ))}
          <path
            d="M0 80 L46 70 L92 75 L138 50 L184 55 L228 35 L274 40 L320 18 L320 100 L0 100 Z"
            fill="url(#step3-area)"
          />
          <path
            d="M0 80 L46 70 L92 75 L138 50 L184 55 L228 35 L274 40 L320 18"
            fill="none"
            stroke={ACCENT.solid}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {[
            [0, 80],
            [46, 70],
            [92, 75],
            [138, 50],
            [184, 55],
            [228, 35],
            [274, 40],
            [320, 18],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === 7 ? 3.5 : 2}
              fill="white"
              stroke={ACCENT.solid}
              strokeWidth={i === 7 ? 2.5 : 1.5}
            />
          ))}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[9.5px] text-slate-400">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN", "Hôm nay"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(
          [
            ["Đơn hàng", "407", "+18%"],
            ["AOV", "₫61k", "+12%"],
            ["Hoàn tiền", "0.4%", "−0.2%"],
          ] as Array<[string, string, string]>
        ).map(([l, v, d]) => (
          <div key={l} className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] font-medium text-slate-500">{l}</p>
            <p className="font-display mt-0.5 text-[15px] font-bold tabular-nums text-slate-900">
              {v}
            </p>
            <p className="font-mono text-[9.5px] font-semibold text-emerald-600">
              {d}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            Theo khóa học
          </p>
          <span className="font-mono text-[10px] font-medium text-slate-500">
            Xem tất cả →
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {courses.map((c) => (
            <div
              key={c.t}
              className="rounded-lg border border-slate-100 bg-white p-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="truncate text-[11.5px] font-semibold text-slate-900">
                  {c.t}
                </p>
                <p className="font-display text-[12.5px] font-bold tabular-nums text-slate-900">
                  {c.v}
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.w}%`, background: c.c }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-slate-400">
                  {c.n} đơn
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
