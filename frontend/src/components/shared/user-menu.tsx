"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Settings, ChevronDown, BookOpen } from "lucide-react";
import { signOut } from "@/app/actions/auth";

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
  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
        >
          Đăng nhập
        </Link>
        {/* [DEPRECATED per PRD §4.3] - hidden 2026-05-12
            Teacher self-signup CTA. PRD §3.5 teachers join via center invite only.
        <Link
          href="/register"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Bắt đầu miễn phí
        </Link>
        */}
      </div>
    );
  }

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
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
          >
            {/* User Info */}
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <User className="h-4 w-4 text-slate-400" />
                Quản lý hồ sơ
              </Link>
              <Link
                href="/dashboard/courses"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <BookOpen className="h-4 w-4 text-slate-400" />
                Khóa học của tôi
              </Link>
              <Link
                href="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Trang cá nhân
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-slate-100 py-1">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                  onClick={() => setOpen(false)}
                >
                  <LogOut className="h-4 w-4" />
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
