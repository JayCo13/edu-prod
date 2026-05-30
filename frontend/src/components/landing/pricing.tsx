import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { ACCENT } from "./_accent";

/**
 * Pricing — 4 tiers per-active-teacher. Growth highlighted.
 * Ported from the design bundle.
 */

interface PlanProps {
  name: string;
  range: string;
  price: string;
  suffix: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: { label: string; href: string };
}

// Pricing trong giai đoạn early access — số liệu hold-firm, không hứa SLA,
// không hứa tích hợp ngân hàng, không hứa support 24/7. Các tính năng bên
// dưới là những thứ đã hoặc đang được xây — không phải roadmap xa.
const PLANS: PlanProps[] = [
  {
    name: "Early access",
    range: "≤ 10 giáo viên",
    price: "Miễn phí",
    suffix: "trong giai đoạn beta",
    desc:
      "Cho trung tâm hoặc trường học muốn dùng thử và góp ý cải tiến trong giai đoạn beta.",
    features: [
      "Tính lương theo giờ / theo buổi / lương tháng cố định (trung tâm)",
      "Thời khoá biểu cả khối trên một bảng Thứ × Tiết (trường học)",
      "Lịch dạy nhiều giáo viên · cảnh báo trùng giờ",
      "Xuất Excel bảng lương · in / chia sẻ mã QR thời khoá biểu",
      "Quản lý giáo viên, mời qua email",
      "Hỗ trợ qua email trong giờ hành chính",
    ],
    cta: { label: "Đăng ký dùng thử", href: "#demo" },
  },
  {
    name: "Growth",
    range: "≤ 50 giáo viên",
    price: "Sẽ thông báo",
    suffix: "trước ≥ 30 ngày khi tính phí",
    desc:
      "Khi rời beta sẽ chuyển sang tính phí theo số giáo viên active. Báo trước ≥ 30 ngày.",
    highlight: true,
    features: [
      "Mọi tính năng của gói Early access",
      "Phân vai trò quản trị viên / giáo viên",
      "Nhiều quản trị viên cùng một tổ chức",
      "Nhật ký thay đổi cho điều chỉnh lương",
      "Nạp danh sách giáo viên / lớp / học sinh từ Excel",
    ],
    cta: { label: "Đặt lịch demo 15 phút", href: "#demo" },
  },
  {
    name: "Liên hệ",
    range: "50+ GV hoặc cần tuỳ chỉnh",
    price: "Liên hệ",
    suffix: "",
    desc: "Trung tâm hoặc trường lớn, có nhu cầu tuỳ chỉnh hoặc tích hợp.",
    features: [
      "Tập huấn sử dụng tại trung tâm / trường",
      "Hỗ trợ chuyển dữ liệu từ Excel",
      "Tuỳ chỉnh báo cáo theo nhu cầu",
      "Hợp đồng + xuất hoá đơn VAT",
    ],
    cta: { label: "Gửi email", href: "mailto:hello@edura.vn" },
  },
];

export default function Pricing() {
  const A = ACCENT;
  return (
    <section id="pricing" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ color: A.solid }}
          >
            · BẢNG GIÁ
          </p>
          <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
            Đang trong giai đoạn dùng thử.
            <br />
            <span className="text-slate-400">
              Miễn phí cho trung tâm và trường học.
            </span>
          </h2>
          <p className="mt-4 text-[15px] text-slate-600">
            Khi kết thúc giai đoạn dùng thử sẽ chuyển sang tính phí theo số
            giáo viên hoạt động. Chúng tôi sẽ báo trước ít nhất 30 ngày — bạn
            không bị bất ngờ.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Plan key={p.name} {...p} A={A} />
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-slate-400">
          * Khái niệm &ldquo;giáo viên active&rdquo; = có ≥ 1 buổi dạy trong
          tháng. Slot không dùng = không tính phí khi tới giai đoạn tính phí.
        </p>
      </div>
    </section>
  );
}

function Plan({
  name,
  range,
  price,
  suffix,
  desc,
  features,
  highlight,
  cta,
  A,
}: PlanProps & { A: typeof ACCENT }) {
  // Highlight pattern: white card + 2px accent border + accent-tinted shadow
  // ring, instead of the previous dark-inverted look. Keeps text colors
  // consistent across all 3 plans and reads as "premium" without the heavy
  // black fill.
  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white p-6 transition-all ${
        highlight ? "border-2 shadow-2xl" : "border border-slate-200"
      }`}
      style={
        highlight
          ? {
              borderColor: A.solid,
              boxShadow: `0 24px 50px -12px ${A.shadow}, 0 0 0 6px ${A.tint}`,
            }
          : undefined
      }
    >
      {highlight && (
        <span
          className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-semibold text-white"
          style={{ background: A.solid }}
        >
          <Sparkles className="h-3 w-3" />
          Phổ biến nhất
        </span>
      )}
      <p
        className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]"
        style={highlight ? { color: A.solid } : { color: "rgb(148 163 184)" }}
      >
        {name}
      </p>
      <p className="mt-1 text-[12.5px] font-medium text-slate-700">{range}</p>
      {/* Price + suffix stack vertically so long copy ("Đang định giá",
          "thông báo trước khi tính phí") doesn't crash into the 36px price
          number on the same line. */}
      <div className="mt-4">
        <p className="font-display text-[36px] font-bold leading-tight tracking-tight tabular-nums text-slate-900">
          {price}
        </p>
        {suffix && (
          <p className="mt-1 font-mono text-[11.5px] leading-snug text-slate-500">
            {suffix}
          </p>
        )}
      </div>
      <p className="mt-3 text-[13px] text-slate-600">{desc}</p>
      <ul className="mt-5 flex-1 space-y-2 text-[13px] text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span
              className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
              style={{ background: A.tint, color: A.solid }}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-all hover:scale-[1.01] ${
          highlight
            ? "text-white"
            : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        }`}
        style={highlight ? { background: A.solid } : undefined}
      >
        {cta.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
