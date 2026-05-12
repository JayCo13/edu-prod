import { ArrowRight, Check, Sparkles } from "lucide-react";
import { ACCENT } from "./_accent";

interface PlanProps {
  name: string;
  price: string;
  suffix: string;
  desc: string;
  features: string[];
  highlight?: boolean;
}

function Plan({ name, price, suffix, desc, features, highlight }: PlanProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-7 transition-all ${
        highlight
          ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/20"
          : "border border-slate-200 bg-white"
      }`}
    >
      {highlight && (
        <span
          className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-semibold text-white"
          style={{ background: ACCENT.solid }}
        >
          <Sparkles className="h-3 w-3" strokeWidth={2.5} /> Phổ biến nhất
        </span>
      )}
      <p
        className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] ${
          highlight ? "text-white/60" : "text-slate-400"
        }`}
      >
        {name}
      </p>
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={`font-display text-[42px] font-bold tracking-tight ${
            highlight ? "text-white" : "text-slate-900"
          }`}
        >
          {price}
        </span>
        <span
          className={`text-[14px] ${highlight ? "text-white/60" : "text-slate-500"}`}
        >
          {suffix}
        </span>
      </div>
      <p
        className={`mt-2 text-[13.5px] ${highlight ? "text-white/70" : "text-slate-600"}`}
      >
        {desc}
      </p>
      <ul
        className={`mt-6 flex-1 space-y-2.5 text-[13.5px] ${
          highlight ? "text-white/85" : "text-slate-700"
        }`}
      >
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                highlight ? "bg-white/15" : ""
              }`}
              style={
                !highlight
                  ? { background: ACCENT.tint, color: ACCENT.solid }
                  : { color: "white" }
              }
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      {/* [DEPRECATED per PRD §4.3] - hidden 2026-05-12
          Teacher self-signup CTA. PRD §8.1: replace with demo-booking CTA for center owners.
      <a
        href="/register"
        className={`mt-7 inline-flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13.5px] font-semibold transition-all hover:scale-[1.01] ${
          highlight
            ? "bg-white text-slate-900"
            : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        }`}
      >
        {highlight ? "Bắt đầu Pro" : "Bắt đầu miễn phí"}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
      */}
    </div>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ color: ACCENT.solid }}
          >
            · 02 — Bảng giá
          </p>
          <h2 className="font-display mt-3 text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
            Đơn giản. Minh bạch.{" "}
            <span className="text-slate-400">Không phát sinh.</span>
          </h2>
          <p className="mt-4 text-[15px] text-slate-600">
            Bắt đầu miễn phí — chỉ trả phí khi bạn đã có doanh thu.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mx-auto lg:max-w-4xl">
          <Plan
            name="Starter"
            price="Miễn phí"
            suffix="mãi mãi"
            desc="Đủ dùng để khởi đầu — không cần thẻ tín dụng."
            features={[
              "1 khóa học · không giới hạn bài giảng",
              "100GB storage video",
              "Subdomain .vlearning.io",
              "Phí giao dịch 8% mỗi đơn",
            ]}
          />
          <Plan
            name="Pro"
            price="₫390k"
            suffix="/tháng"
            desc="Cho giáo viên muốn build thương hiệu chuyên nghiệp."
            highlight
            features={[
              "Khóa & học viên không giới hạn",
              "1TB storage · CDN toàn cầu",
              "Tên miền riêng + email branded",
              "Phí giao dịch chỉ 5%",
              "Livestream Zoom tích hợp",
              "Hỗ trợ ưu tiên 24/7",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
