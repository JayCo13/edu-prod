"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

import { ACCENT } from "./_accent";

/**
 * HowItWorks — 3-step explainer with interactive tab + preview pane.
 * Ported from the design bundle.
 *
 * Left column = clickable step list. Right column = matching preview
 * (Excel import → weekly grid with conflict warning → monthly payroll
 * summary with pay status).
 */

type StepShape = {
  n: string;
  title: string;
  desc: string;
  stats: [string, string][];
};

const STEPS: StepShape[] = [
  {
    n: "01",
    title: "Nhập danh sách giáo viên",
    desc:
      "Import từ file Excel cũ của trung tâm — hoặc thêm thủ công. Set đơn giá lương riêng cho từng người (theo giờ, theo buổi, hay lương cứng).",
    stats: [
      ["Import", "Excel mẫu"],
      ["Thời gian", "~1 giờ"],
      ["Lưu trữ", "Supabase EU"],
    ],
  },
  {
    n: "02",
    title: "Lên lịch dạy + điểm danh",
    desc:
      "Đặt lịch theo tuần trên grid Ngày × Tiết. Giáo viên điểm danh từ /dashboard trên điện thoại — không cần app riêng.",
    stats: [
      ["Detect", "Trùng giờ tức thì"],
      ["Mobile", "Web app"],
      ["BYOM", "Zoom / Meet / Teams"],
    ],
  },
  {
    n: "03",
    title: "Cuối tháng — chốt lương",
    desc:
      'Nhấn "Chốt lương" → hệ thống tổng hợp toàn bộ buổi đã dạy + thưởng / khấu trừ → xuất Excel BẢNG LƯƠNG đúng định dạng đối chiếu ngân hàng.',
    stats: [
      ["Format", "Excel chuẩn"],
      ["Ngân hàng", "Đối chiếu OK"],
      ["Thanh toán", "Đánh dấu T+0"],
    ],
  },
];

export default function HowItWorks() {
  const A = ACCENT;
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
            style={{ color: A.solid }}
          >
            · 03 — CÁCH HOẠT ĐỘNG
          </p>
          <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
            Ba bước, từ Excel cũ đến VLearning.
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,_5fr)_minmax(0,_6fr)] lg:gap-16">
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
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[14px] font-bold transition-colors ${
                        on
                          ? "text-white"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                      style={on ? { background: A.solid } : undefined}
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

          <div className="relative">
            <div className="rounded-2xl bg-white p-7 shadow-xl shadow-slate-200/60 ring-1 ring-slate-100 sm:p-8">
              {active === 0 && <Step1 />}
              {active === 1 && <Step2 />}
              {active === 2 && <Step3 />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Step 1: Import giáo viên ───────────────────────────────────────────

function Step1() {
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        Import giáo viên
      </p>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-600 ring-1 ring-slate-200">
          <span
            className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold text-white"
            style={{ background: "#107c41" }}
          >
            X
          </span>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-slate-600">
          Kéo file{" "}
          <span className="font-semibold text-slate-900">danh-sach-gv.xlsx</span>{" "}
          vào đây
        </p>
        <p className="mt-1 font-mono text-[9.5px] text-slate-400">
          hoặc <span className="underline">tải file Excel mẫu</span>
        </p>
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
        Sau khi import — 18 giáo viên
      </p>
      <div className="mt-2 space-y-1.5">
        {[
          {
            n: "Cô Linh Lê",
            sub: "linh.le@…",
            r: "Teacher",
            price: "250.000đ / giờ",
          },
          {
            n: "Thầy Hùng Nguyễn",
            sub: "hung.ng@…",
            r: "Admin",
            price: "300.000đ / giờ",
          },
          {
            n: "Cô Mai Trần",
            sub: "mai.tt@…",
            r: "Teacher",
            price: "220.000đ / giờ",
          },
          {
            n: "Thầy Đức Phan",
            sub: "duc.pn@…",
            r: "Teacher",
            price: "5.000.000đ / tháng",
          },
        ].map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold text-white"
              style={{
                background: ["#4f46e5", "#10b981", "#f59e0b", "#7c3aed"][i],
              }}
            >
              {t.n.split(" ").slice(-1)[0][0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-slate-900">
                {t.n}
              </p>
              <p className="truncate font-mono text-[9.5px] text-slate-400">
                {t.sub}
              </p>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                t.r === "Admin"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.r}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-slate-700">
              {t.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Weekly grid + conflict ─────────────────────────────────────

function Step2() {
  type Cell = { c: string; l: string } | null;
  const rows: { h: string; row: Cell[] }[] = [
    {
      h: "08:00",
      row: [
        { c: "#4f46e5", l: "IELTS · L" },
        null,
        { c: "#10b981", l: "GT · H" },
        null,
        { c: "#4f46e5", l: "IELTS · L" },
        null,
        null,
      ],
    },
    {
      h: "10:00",
      row: [
        null,
        { c: "#f59e0b", l: "THPT · M" },
        null,
        { c: "#10b981", l: "GT · H" },
        null,
        { c: "#f59e0b", l: "THPT · M" },
        null,
      ],
    },
    {
      h: "15:00",
      row: [
        { c: "#7c3aed", l: "Hoa" },
        null,
        { c: "#4f46e5", l: "L" },
        null,
        { c: "#7c3aed", l: "Hoa" },
        { c: "#4f46e5", l: "L" },
        null,
      ],
    },
    {
      h: "19:00",
      row: [
        null,
        { c: "#4f46e5", l: "IELTS · L" },
        { c: "#e11d48", l: "⚠ Trùng" },
        null,
        null,
        { c: "#10b981", l: "GT · H" },
        { c: "#7c3aed", l: "Q&A" },
      ],
    },
  ];
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        Lịch tuần · 12 — 18 / 05
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-8 bg-slate-50 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
          {["Giờ", "T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d, i) => (
            <div
              key={i}
              className={`px-1.5 py-1.5 text-center ${
                i > 0 ? "border-l border-slate-200" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-8 border-t border-slate-100">
            <div className="px-1.5 py-2 text-center font-mono text-[9.5px] tabular-nums text-slate-500">
              {r.h}
            </div>
            {r.row.map((cell, j) => (
              <div key={j} className="border-l border-slate-100 p-0.5">
                {cell ? (
                  <span
                    className="block truncate rounded px-1 py-0.5 text-[8.5px] font-semibold text-white"
                    style={{ background: cell.c }}
                  >
                    {cell.l}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
        {(
          [
            ["#4f46e5", "Cô Linh"],
            ["#10b981", "Thầy Hùng"],
            ["#f59e0b", "Cô Mai"],
            ["#7c3aed", "Cô Hoa"],
          ] as const
        ).map(([c, n]) => (
          <span key={n} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded" style={{ background: c }} />
            {n}
          </span>
        ))}
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 font-mono text-[10px] font-semibold text-rose-700">
        ⚠ Phát hiện 1 trùng giờ — Cô Linh & Thầy Hùng cùng phòng B2 19:00 T4
      </div>
    </div>
  );
}

// ── Step 3: Monthly payroll summary ────────────────────────────────────

function Step3() {
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            Bảng lương tháng 04 / 2026
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="font-display text-[34px] font-bold tracking-tight tabular-nums text-slate-900">
              184.250.000
              <span className="font-mono text-[14px] font-medium text-slate-400">
                đ
              </span>
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
              +12%
            </span>
          </div>
          <p className="mt-1 font-mono text-[10.5px] text-slate-400">
            18 giáo viên · vs T3: 164.510.000đ
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white"
          style={{ background: "#059669" }}
        >
          <span
            className="grid h-3.5 w-3.5 place-items-center rounded text-[8px] font-bold text-white"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            X
          </span>
          Xuất Excel
        </span>
      </div>

      <div className="mt-5 space-y-1.5">
        {[
          {
            n: "Cô Linh L.",
            m: "Theo giờ · 84h",
            v: "22.000.000đ",
            paid: true,
          },
          {
            n: "Thầy Hùng N.",
            m: "Theo giờ · 62h + admin",
            v: "18.600.000đ",
            paid: true,
          },
          {
            n: "Cô Mai T.",
            m: "Theo giờ · 48h",
            v: "11.060.000đ",
            paid: true,
          },
          { n: "Thầy Đức P.", m: "Lương cứng", v: "5.000.000đ", paid: false },
          {
            n: "Cô Hoa V.",
            m: "Theo giờ · 72h",
            v: "14.400.000đ",
            paid: false,
          },
        ].map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold text-white"
              style={{
                background: [
                  "#4f46e5",
                  "#10b981",
                  "#f59e0b",
                  "#7c3aed",
                  "#e11d48",
                ][i],
              }}
            >
              {r.n.split(" ").slice(-1)[0][0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-slate-900">
                {r.n}
              </p>
              <p className="truncate font-mono text-[10px] text-slate-400">
                {r.m}
              </p>
            </div>
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-slate-900">
              {r.v}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                r.paid
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${
                  r.paid ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {r.paid ? "Đã trả" : "Chờ trả"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
