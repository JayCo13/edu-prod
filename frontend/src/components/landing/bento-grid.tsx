import type { ReactNode } from "react";
import {
  Shield,
  Video,
  Globe,
  Wallet,
  Users,
  Zap,
  Play,
} from "lucide-react";
import { ACCENT } from "./_accent";

interface CardProps {
  span?: string;
  children: ReactNode;
}

function Card({ span = "", children }: CardProps) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-[0_18px_40px_-12px_rgb(15_23_42/0.08)] ${span}`}
    >
      {children}
    </div>
  );
}

interface TitleProps {
  icon: ReactNode;
  color: string;
  bg: string;
  children: ReactNode;
}

function Title({ icon, color, bg, children }: TitleProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: bg, color }}
      >
        {icon}
      </span>
      <h3 className="font-display text-[15.5px] font-semibold text-slate-900">
        {children}
      </h3>
    </div>
  );
}

export default function BentoGrid() {
  return (
    <section id="features" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p
              className="font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
              style={{ color: ACCENT.solid }}
            >
              · 06 — Tính năng cốt lõi
            </p>
            <h2 className="font-display mt-3 text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
              Mọi thứ bạn cần,
              <br />
              <span className="text-slate-400">trong một nền tảng.</span>
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-slate-600">
            Từ hosting video bảo mật đến thanh toán quốc tế, chúng tôi xử lý
            toàn bộ phần kỹ thuật — bạn chỉ cần tập trung vào nội dung.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {/* 1. Video security — large */}
          <Card span="sm:col-span-2 sm:row-span-2">
            <Title
              icon={<Shield className="h-4 w-4" strokeWidth={2} />}
              color={ACCENT.solid}
              bg={ACCENT.tint}
            >
              Bảo mật video VOD
            </Title>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-600">
              Mã hóa token theo phiên, khóa IP, watermark động hiển thị email
              học viên. Không có cách nào tải lậu nội dung.
            </p>
            <div className="mt-6 grow">
              <div className="relative h-56 overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-700">
                <div className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </span>
                </div>
                <div className="absolute right-3 top-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm">
                  hocvien@email.vn · 192.168.x.x
                </div>
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-white/70">
                    12:34
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full"
                      style={{ width: "62%", background: ACCENT.solid }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-white/70">
                    20:08
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["AES-128", "Token JWT", "IP-locked", "Watermark", "DRM-ready"].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10.5px] font-medium text-slate-700"
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
            </div>
          </Card>

          {/* 2. Livestream */}
          <Card>
            <Title
              icon={<Video className="h-4 w-4" strokeWidth={2} />}
              color="#e11d48"
              bg="#fff1f2"
            >
              Livestream qua Zoom
            </Title>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              Tạo phòng live trực tiếp từ dashboard. Học viên đã mua tự động
              nhận link.
            </p>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-rose-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />{" "}
                  ĐANG LIVE
                </span>
                <span className="font-mono text-[10px] text-slate-400">19:32</span>
              </div>
              <p className="mt-1.5 text-[12px] font-semibold text-slate-900">
                Hình học không gian — 12.B
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex -space-x-1">
                  {["#fda4af", "#fcd34d", "#a7f3d0", "#bfdbfe", "#ddd6fe"].map(
                    (c) => (
                      <span
                        key={c}
                        className="h-4 w-4 rounded-full border border-white"
                        style={{ background: c }}
                      />
                    ),
                  )}
                </div>
                <span className="text-[10px] text-slate-500">47 đang xem</span>
              </div>
            </div>
          </Card>

          {/* 3. Custom domain */}
          <Card>
            <Title
              icon={<Globe className="h-4 w-4" strokeWidth={2} />}
              color="#0284c7"
              bg="#e0f2fe"
            >
              Tên miền thương hiệu
            </Title>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              Học viên chỉ thấy thương hiệu của bạn — không thấy VLearning.
            </p>
            <div className="mt-4 space-y-1.5">
              {["thaytoan.vn", "luyenthi-anh.io", "edu.coban.com"].map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5"
                >
                  <span className="font-mono text-[11px] font-medium text-slate-700">
                    {d}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-700">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />{" "}
                    active
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 4. Payments */}
          <Card>
            <Title
              icon={<Wallet className="h-4 w-4" strokeWidth={2} />}
              color="#059669"
              bg="#d1fae5"
            >
              Thanh toán toàn cầu
            </Title>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              Lemon Squeezy, MoMo, ZaloPay, VNPay — tự động xử lý thuế và hóa
              đơn.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["VISA", "Master", "MoMo", "ZaloPay", "VNPay", "PayPal"].map(
                (t) => (
                  <span
                    key={t}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-slate-700"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>
          </Card>

          {/* 5. Students */}
          <Card>
            <Title
              icon={<Users className="h-4 w-4" strokeWidth={2} />}
              color="#d97706"
              bg="#fef3c7"
            >
              Quản lý học viên
            </Title>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              Phân quyền theo gói, theo dõi tiến độ, gửi email nhắc bài tự động.
            </p>
            <div className="mt-4">
              <div className="flex h-16 items-end gap-1">
                {[40, 65, 50, 80, 60, 90, 75, 100, 85, 95, 70, 88].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        background: i === 7 ? ACCENT.solid : "#e2e8f0",
                      }}
                    />
                  ),
                )}
              </div>
              <p className="mt-2 text-[10.5px] text-slate-500">
                Tỉ lệ hoàn thành — 12 tuần gần nhất
              </p>
            </div>
          </Card>

          {/* 6. Performance */}
          <Card>
            <Title
              icon={<Zap className="h-4 w-4" strokeWidth={2} />}
              color="#7c3aed"
              bg="#ede9fe"
            >
              Hiệu suất tối ưu
            </Title>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              CDN toàn cầu, tải dưới 1 giây. Lighthouse 98+ ngay từ ngày đầu.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {[
                { l: "FCP", v: "0.8s" },
                { l: "LCP", v: "1.2s" },
                { l: "CLS", v: "0.01" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-lg bg-slate-50 px-2 py-2 text-center"
                >
                  <p className="font-display text-[15px] font-bold tabular-nums text-slate-900">
                    {s.v}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
