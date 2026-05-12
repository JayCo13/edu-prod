import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { safeGetUser } from "@/lib/supabase/safe-auth";
import UserMenu, { type UserMenuData } from "@/components/shared/user-menu";
import { ACCENT } from "@/components/landing/_accent";

const FOOTER_COLS = [
  { h: "Sản phẩm", l: ["Tính năng", "Bảng giá", "Tích hợp", "API docs"] },
  { h: "Khám phá", l: ["Khóa học", "Giáo viên", "Câu chuyện thành công", "Blog"] },
  { h: "Hỗ trợ", l: ["Trung tâm trợ giúp", "Liên hệ", "Trạng thái hệ thống", "Cộng đồng"] },
  { h: "Pháp lý", l: ["Điều khoản", "Chính sách bảo mật", "Cookie", "DMCA"] },
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
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight text-slate-900"
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-[10px] text-[11px] font-black text-white"
              style={{
                background: `linear-gradient(135deg, ${ACCENT.from}, ${ACCENT.to})`,
              }}
            >
              V
            </span>
            VLearning
          </Link>

          <ul className="hidden items-center gap-9 text-[14px] font-medium text-slate-600 md:flex">
            <li>
              <Link href="/#features" className="transition-colors hover:text-slate-900">
                Tính năng
              </Link>
            </li>
            <li>
              <Link href="/#how" className="transition-colors hover:text-slate-900">
                Cách hoạt động
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className="transition-colors hover:text-slate-900">
                Bảng giá
              </Link>
            </li>
            <li>
              <Link href="/teachers" className="transition-colors hover:text-slate-900">
                Giáo viên
              </Link>
            </li>
          </ul>

          <UserMenu user={userData} />
        </nav>
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
                VLearning
              </Link>
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-500">
                Bệ phóng độc lập cho sự nghiệp giảng dạy của bạn. White-label
                EdTech SaaS made in Vietnam.
              </p>
              <div className="mt-5 flex items-center gap-2">
                {["Twitter", "Facebook", "YouTube", "GitHub"].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 font-mono text-[10px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    {s[0]}
                  </a>
                ))}
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
              © {new Date().getFullYear()} VLearning. All rights reserved.
            </p>
            <p className="font-mono text-[12px] text-slate-400">
              v.2.4.1 · 99.98% uptime · made with ♥ in Hanoi
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
