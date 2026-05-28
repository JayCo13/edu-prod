"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  CalendarDays,
  UserCog,
  Settings,
  X,
  GraduationCap,
  Wallet,
  Banknote,
} from "lucide-react";

import { useSidebar } from "@/components/admin/sidebar-context";
import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";

/**
 * MobileSidebar
 * =============
 * Full-screen drawer sidebar for mobile devices.
 * Uses Framer Motion AnimatePresence for smooth enter/exit:
 *   - Backdrop: fades in/out
 *   - Drawer: slides in from left with spring physics
 *   - Menu items: staggered entrance
 */

// ── Shared nav config (same as desktop) ────────────────────────────────────

type TenantKind = "CENTER" | "SCHOOL";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForAdmin?: boolean;
  kinds?: readonly TenantKind[];
  betaFor?: readonly TenantKind[];
}

// Mirrors animated-sidebar.tsx NAV_ITEMS — keep in sync.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lịch dạy", href: "/dashboard/calendar", icon: Calendar, kinds: ["CENTER"] },
  { label: "Thời khoá biểu", href: "/dashboard/timetable", icon: CalendarDays, kinds: ["SCHOOL"] },
  { label: "Khóa học", href: "/dashboard/courses", icon: BookOpen, kinds: ["CENTER"] },
  { label: "Giáo viên", href: "/dashboard/teachers", icon: UserCog },
  { label: "Bảng lương", href: "/admin/payroll", icon: Wallet, kinds: ["CENTER"] },
  { label: "Nhận lương", href: "/dashboard/payouts", icon: Banknote, hideForAdmin: true, kinds: ["CENTER"] },
  { label: "Cài đặt", href: "/admin/settings", icon: Settings },
  // [DEPRECATED per PRD §4.3] - hidden 2026-05-12 — teacher public storefront out of scope
  // { label: "Trang cá nhân", href: "/dashboard/profile", icon: Settings },
];

// ── Animation Variants ─────────────────────────────────────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.1 } },
};

const drawerVariants = {
  hidden: { x: "-100%" },
  visible: {
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    x: "-100%",
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

const listVariants = {
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function MobileSidebar() {
  const pathname = usePathname();
  const { isMobileOpen, closeMobile } = useSidebar();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [kind, setKind] = useState<TenantKind | null>(null);
  useEffect(() => {
    getCurrentTenantContextForClient().then((r) => {
      if (r.success && r.data) {
        setIsAdmin(r.data.isAdmin);
        setKind(r.data.kind);
      }
    });
  }, []);

  const effectiveKind: TenantKind = kind ?? "CENTER";
  const visibleItems = NAV_ITEMS.filter((it) => {
    if (isAdmin === true && it.hideForAdmin) return false;
    if (it.kinds && !it.kinds.includes(effectiveKind)) return false;
    return true;
  });

  return (
    <AnimatePresence>
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-backdrop"
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeMobile}
          />

          {/* Drawer */}
          <motion.aside
            key="mobile-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl lg:hidden"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <motion.nav
              className="mt-4 flex flex-1 flex-col gap-1 px-3"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const isBeta = !!item.betaFor?.includes(effectiveKind);

                const betaBadge = isBeta && (
                  <span
                    className="ml-auto rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200"
                    title="Sắp ra mắt"
                  >
                    Beta
                  </span>
                );

                if (isBeta) {
                  return (
                    <motion.div key={item.href} variants={itemVariants}>
                      <div
                        aria-disabled="true"
                        className="relative flex cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.label}
                        {betaBadge}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div key={item.href} variants={itemVariants}>
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className={`
                        relative flex items-center gap-3 rounded-xl px-4 py-3
                        text-sm font-medium transition-colors
                        ${
                          isActive
                            ? "bg-slate-50 text-slate-900"
                            : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        }
                      `}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
