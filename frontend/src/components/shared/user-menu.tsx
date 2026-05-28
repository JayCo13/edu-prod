"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  CalendarDays,
  Users,
  LayoutGrid,
  LayoutDashboard,
  Building2,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";
import { ACCENT } from "@/components/landing/_accent";

// Project signature features per product face (CENTER vs SCHOOL, migration
// 0031). Items belonging to one face only carry a `kinds` filter; the
// menu picks the right subset at render time so the dropdown matches what
// the user actually has access to in the sidebar.
type TenantKind = "CENTER" | "SCHOOL";

type MenuItem = {
  href: string;
  label: string;
  sub: string;
  icon: typeof Calculator;
  accent?: boolean;
  kinds?: readonly TenantKind[];
};

const MENU_ITEMS: readonly MenuItem[] = [
  // Trang chủ quản trị — luôn ở đầu, là điểm đáp đầu tiên sau khi đăng
  // nhập, cho cả CENTER lẫn SCHOOL.
  {
    href: "/dashboard",
    label: "Trang chủ",
    sub: "Tổng quan trung tâm · việc cần làm",
    icon: LayoutDashboard,
  },
  // CENTER-only: payroll is the killer feature for trung tâm dạy thêm.
  {
    href: "/admin/payroll",
    label: "Bảng lương",
    sub: "Tính lương · xuất Excel",
    icon: Calculator,
    accent: true,
    kinds: ["CENTER"],
  },
  // CENTER-only: instance calendar with conflict detection.
  {
    href: "/dashboard/calendar",
    label: "Lịch dạy",
    sub: "Nhiều giáo viên · cảnh báo trùng giờ",
    icon: CalendarDays,
    kinds: ["CENTER"],
  },
  // SCHOOL-only: weekly timetable template (Day × Period × Teacher grid).
  {
    href: "/dashboard/timetable",
    label: "Thời khoá biểu",
    sub: "Lưới tuần · in / QR cho học sinh",
    icon: LayoutGrid,
    accent: true,
    kinds: ["SCHOOL"],
  },
  // Shared by both faces (SCHOOL teachers use the lite mode — no auth account).
  {
    href: "/dashboard/teachers",
    label: "Giáo viên",
    sub: "Quản lý hồ sơ · vai trò",
    icon: Users,
  },
  // Settings label changes with face — labels are computed at render time.
  {
    href: "/admin/settings",
    label: "Cài đặt",
    sub: "Thông tin · thành viên",
    icon: Building2,
  },
];

/**
 * UserMenu
 * ========
 * Auth-aware header component — receives user data from SERVER.
 * No client-side auth fetching needed (SSR-safe).
 *
 *   - user = null → shows "Đăng nhập" + "Bắt đầu miễn phí"
 *   - user = data → shows avatar + name + dropdown
 */

export interface UserMenuData {
  name: string;
  email: string;
}

interface UserMenuProps {
  user: UserMenuData | null;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Resolve the user's tenant kind so the dropdown items + header label
  // match the product face (trung tâm vs trường học). Default CENTER
  // during load to keep the menu stable before resolution.
  const [kind, setKind] = useState<TenantKind>("CENTER");
  useEffect(() => {
    if (!user) return;
    getCurrentTenantContextForClient().then((r) => {
      if (r.success && r.data) setKind(r.data.kind);
    });
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Logged Out ──────────────────────────────────────────────
  // Render nothing — the parent layout already shows the "Đăng nhập" link
  // + primary CTA for logged-out users. UserMenu only handles the avatar
  // dropdown for authenticated sessions.
  if (!user) return null;

  const initials = user.name.substring(0, 2).toUpperCase();

  // ── Logged In ───────────────────────────────────────────────
  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        whileTap={{ scale: 0.97 }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-[10px] font-bold text-white">
          {initials}
        </div>
        <span className="hidden max-w-[120px] truncate font-medium text-slate-700 sm:block">
          {user.name}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
            style={{
              boxShadow: `0 24px 50px -16px ${ACCENT.shadow}, 0 0 0 1px rgb(15 23 42 / 0.04)`,
            }}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
          >
            {/* Identity — email is the anchor (per user request to keep
                only email + logout from the previous version). Name kept
                as small label above for context. */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/40 px-4 py-3.5">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-black text-white"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT.from}, ${ACCENT.to})`,
                }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">
                  {user.name}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Project signature features — filtered by tenant kind.
                Settings label tweaks per face ("Cài đặt trung tâm" vs
                "Cài đặt trường"). */}
            <div className="py-1.5">
              <p className="px-4 pb-1 pt-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
                · {kind === "SCHOOL" ? "Chức năng trường học" : "Chức năng trung tâm"}
              </p>
              {MENU_ITEMS.filter(
                (it) => !it.kinds || it.kinds.includes(kind),
              ).map((it) => {
                const Icon = it.icon;
                const isSettings = it.href === "/admin/settings";
                const label = isSettings
                  ? kind === "SCHOOL"
                    ? "Cài đặt trường"
                    : "Cài đặt trung tâm"
                  : it.label;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-start gap-3 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors"
                      style={
                        it.accent
                          ? { background: ACCENT.tint, color: ACCENT.solid }
                          : { background: "rgb(241 245 249)", color: "rgb(71 85 105)" }
                      }
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-medium text-slate-900">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {it.sub}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Logout */}
            <div className="border-t border-slate-100 py-1.5">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                  onClick={() => setOpen(false)}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600">
                    <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  Đăng xuất
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
