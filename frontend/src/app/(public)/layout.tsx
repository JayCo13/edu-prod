import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeGetUser } from "@/lib/supabase/safe-auth";
import UserMenu, { type UserMenuData } from "@/components/shared/user-menu";
import { ACCENT } from "@/components/landing/_accent";

const NAV_ITEMS = [
  { label: "Tính năng", href: "/#features" },
  { label: "Bảng giá", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Liên hệ", href: "mailto:hello@edura.vn" },
];

// Footer columns — B2B center-owner positioning.
// Replaces the old teacher-storefront columns. Copy comes from the
// design bundle's Footer in landing-sections.jsx.
const FOOTER_COLS = [
  { h: "SẢN PHẨM", l: ["Tính năng", "Bảng giá", "Bảng lương", "Lịch dạy", "Tích hợp"] },
  { h: "DÀNH CHO", l: ["Trung tâm Anh ngữ", "Luyện thi", "Gia sư đội nhóm", "Trường liên kết"] },
  { h: "HỖ TRỢ", l: ["Hướng dẫn sử dụng", "Liên hệ", "Trạng thái hệ thống", "Yêu cầu tính năng"] },
  { h: "PHÁP LÝ", l: ["Điều khoản", "Bảo mật & RLS", "Cookie", "Hợp đồng mẫu"] },
];

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  let userData: UserMenuData | null = null;

  try {
    const supabase = await createClient();
    const user = await safeGetUser(supabase);

    if (user) {
      userData = {
        name:
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User",
        email: user.email || "",
      };
    }
  } catch {
    // Supabase not configured yet — show logged-out state
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────
          Three-zone layout: branded logo + BETA pill (left), floating
          capsule nav (center, md+), 2-button CTA group (right). The BETA
          pill with the pulsing dot is the deliberate visual focal point —
          it doubles as honest product-stage signaling and as a kinetic
          accent that draws the eye on otherwise static chrome. */}
      <header
        className="sticky top-0 z-40 bg-white"
        style={{
          // Same "premium accent ring" treatment as the Growth pricing card.
          //   • soft accent glow projecting ~28px downward into the page
          //   • the bottom accent strip is rendered as a separate absolutely
          //     positioned div so it can use a *gradient* (vibrant in the
          //     middle, fades at the edges) — a single flat colored border
          //     looked too dense across full viewport width.
          boxShadow: `0 14px 32px -16px ${ACCENT.shadow}, 0 0 0 1px rgb(15 23 42 / 0.03)`,
        }}
      >
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          {/* Left: logo + product stage badge */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Edura — trang chủ"
              className="group flex items-center transition-transform hover:scale-[1.02]"
            >
              {/* Logo Edura — file gồm icon + wordmark "edura" trong cùng
                  một PNG, nên không cần thêm text bên cạnh. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/edura-logo.png"
                alt="Edura"
                width={200}
                height={150}
                className="h-14 w-auto sm:h-16"
              />
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 lg:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Early access
            </span>
          </div>

          {/* Center: floating capsule nav (md+ only — mobile uses UserMenu) */}
          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full border border-slate-200/80 bg-white px-2 py-1.5 shadow-[0_4px_16px_-4px_rgb(15_23_42/0.08)] md:flex">
            {NAV_ITEMS.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="block rounded-full px-4 py-2 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-100/70 hover:text-slate-900"
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right: auth + primary CTA.
              3-tier visual hierarchy:
                · Đăng nhập   — ghost text link (tertiary)
                · Đăng ký     — outlined pill (secondary)
                · Đặt lịch demo — solid accent CTA (primary) */}
          <div className="flex items-center gap-2">
            {!userData && (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-xl px-3 py-2 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/70 hover:text-slate-900 sm:inline-block"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="hidden items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow md:inline-flex"
                >
                  Đăng ký
                </Link>
                <Link
                  href="/#demo"
                  className="group hidden items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] sm:inline-flex"
                  style={{
                    background: ACCENT.solid,
                    boxShadow: `0 8px 20px -6px ${ACCENT.shadow}`,
                  }}
                >
                  Đặt lịch demo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
            <UserMenu user={userData} />
          </div>
        </nav>
        {/* Bottom accent strip — gradient line that fades at the viewport
            edges and peaks vibrant in the middle. Sticky <header> already
            establishes a positioning context so this absolute child anchors
            to it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${ACCENT.tint} 12%, ${ACCENT.solid}80 50%, ${ACCENT.tint} 88%, transparent 100%)`,
          }}
        />
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-6">
            <div className="col-span-2">
              <Link
                href="/"
                className="font-display flex items-center gap-2.5 text-[16px] font-bold tracking-tight text-slate-900"
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-[8px] text-[10px] font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT.from}, ${ACCENT.to})`,
                  }}
                >
                  V
                </span>
                Edura
              </Link>
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-500">
                Phần mềm quản lý trung tâm giáo dục: lịch dạy, lương giáo viên,
                thời khoá biểu — gom về một chỗ.
              </p>
              <div className="mt-5 space-y-1.5 font-mono text-[11px] text-slate-500">
                <p>
                  <a
                    href="mailto:hello@edura.vn"
                    className="transition-colors hover:text-slate-900"
                  >
                    hello@edura.vn
                  </a>
                </p>
                <p className="text-slate-400">Việt Nam · Early access</p>
              </div>
            </div>
            {FOOTER_COLS.map((c) => (
              <div key={c.h}>
                <h4 className="font-mono text-[12.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {c.h}
                </h4>
                <ul className="mt-4 space-y-2.5 text-[13px] text-slate-600">
                  {c.l.map((x) => (
                    <li key={x}>
                      <a href="#" className="transition-colors hover:text-slate-900">
                        {x}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row sm:items-center">
            <p className="text-[12px] text-slate-400">
              © {new Date().getFullYear()} Edura. Giai đoạn early access.
            </p>
            <p className="font-mono text-[12px] text-slate-400">
              Made in Vietnam.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
