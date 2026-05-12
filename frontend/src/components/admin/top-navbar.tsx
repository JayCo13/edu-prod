"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, ChevronRight, Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { useSidebar } from "@/components/admin/sidebar-context";
import { createClient } from "@/lib/supabase/client";

/**
 * TopNavbar
 * =========
 * Top navigation bar with:
 *   - Hamburger menu button (mobile only)
 *   - Auto-generated breadcrumbs from pathname
 *   - Notification bell with subtle hover animation
 *   - Avatar with spring press (whileTap) effect
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1),
    href: "/" + segments.slice(0, index + 1).join("/"),
    isLast: index === segments.length - 1,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TopNavbar() {
  const pathname = usePathname();
  const { toggleMobile } = useSidebar();
  const breadcrumbs = generateBreadcrumbs(pathname);
  const [initials, setInitials] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.display_name || user.email || "U";
        setInitials(name.substring(0, 2).toUpperCase());
      }
    });
  }, []);

  return (
    <motion.header
      className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-100 bg-white/80 px-4 backdrop-blur-md lg:px-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* ── Mobile Menu Button ────────────────────────────── */}
      <motion.button
        type="button"
        onClick={toggleMobile}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 lg:hidden"
        aria-label="Open menu"
        whileTap={{ scale: 0.92 }}
      >
        <Menu className="h-5 w-5" />
      </motion.button>

      {/* ── Breadcrumbs ───────────────────────────────────── */}
      <nav
        className="hidden items-center gap-1 text-sm lg:flex"
        aria-label="Breadcrumb"
      >
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
            {crumb.isLast ? (
              <span className="font-medium text-slate-900">{crumb.label}</span>
            ) : (
              <span className="text-slate-400 transition-colors hover:text-slate-600">
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* ── Spacer ────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right Actions ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <motion.button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {/* Notification dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
        </motion.button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-slate-100" />

        {/* Avatar */}
        <motion.button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-semibold text-white shadow-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          aria-label="User menu"
        >
          {initials}
        </motion.button>
      </div>
    </motion.header>
  );
}
