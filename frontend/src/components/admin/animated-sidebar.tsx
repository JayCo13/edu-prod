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
  ChevronsLeft,
  GraduationCap,
  Wallet,
  Banknote,
} from "lucide-react";

import { useSidebar } from "@/components/admin/sidebar-context";
import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";

/**
 * AnimatedSidebar
 * ===============
 * Premium collapsible sidebar with Framer Motion animations:
 *   - Desktop: collapses from 256px → 72px with spring animation
 *   - Text fades out smoothly via AnimatePresence
 *   - Active indicator slides between items using layoutId
 *   - Menu items render with staggered entrance animation
 *   - Mobile: renders as a slide-in drawer (handled in DashboardLayout)
 */

// ── Navigation Config ──────────────────────────────────────────────────────

type TenantKind = "CENTER" | "SCHOOL";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hide this item when the viewer's role at the active tenant is admin.
   *  Used for teacher-only surfaces like "Nhận lương" — admins don't
   *  receive payouts, they pay them out. */
  hideForAdmin?: boolean;
  /** Which product face this item belongs to. Omit = always visible.
   *  Migration 0031 introduced the CENTER/SCHOOL split chosen at signup. */
  kinds?: readonly TenantKind[];
  /** Mark as "beta" + disabled for these product faces. Used for
   *  cross-face surfaces that aren't fully built yet (e.g. teacher
   *  management for SCHOOL is still on the roadmap). */
  betaFor?: readonly TenantKind[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // CENTER-only: payroll-driving instance calendar.
  { label: "Lịch dạy", href: "/dashboard/calendar", icon: Calendar, kinds: ["CENTER"] },
  // SCHOOL-only: fixed weekly Mon–Sat × period × teacher grid (PRD §5.5).
  // Generates exportable timetable; doesn't drive payroll.
  { label: "Thời khoá biểu mẫu", href: "/dashboard/timetable", icon: CalendarDays, kinds: ["SCHOOL"] },
  // Admin-managed catalog. CENTER uses it for class definitions; SCHOOL doesn't
  // need it (subjects live inside the timetable section).
  { label: "Khóa học", href: "/dashboard/courses", icon: BookOpen, kinds: ["CENTER"] },
  // Visible in both faces. SCHOOL uses a stripped-down create flow
  // (display_name + color only, no auth account, no invite email — see
  // createTenantTeacher's "lite mode" when email is empty).
  { label: "Giáo viên", href: "/dashboard/teachers", icon: UserCog },
  // Killer feature (PRD §5.8) — CENTER only. SCHOOL is a TKB utility, not a
  // payroll product.
  { label: "Bảng lương", href: "/admin/payroll", icon: Wallet, kinds: ["CENTER"] },
  // Teacher-side surface — admins shouldn't see this (they manage payroll
  // via /admin/payroll). Also CENTER-only since SCHOOL has no payroll.
  { label: "Nhận lương", href: "/dashboard/payouts", icon: Banknote, hideForAdmin: true, kinds: ["CENTER"] },
  { label: "Cài đặt", href: "/admin/settings", icon: Settings },
  // [DEPRECATED per PRD §4.3] - hidden 2026-05-12 — teacher public storefront out of scope
  // { label: "Trang cá nhân", href: "/dashboard/profile", icon: Settings },
];

// ── Animation Variants ─────────────────────────────────────────────────────

const sidebarVariants = {
  expanded: { width: 256 },
  collapsed: { width: 72 },
};

const navContainerVariants = {
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
  hide: {},
};

const navItemVariants = {
  hide: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const textVariants = {
  show: { opacity: 1, width: "auto", transition: { duration: 0.2, delay: 0.05 } },
  hide: { opacity: 0, width: 0, transition: { duration: 0.15 } },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AnimatedSidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebar();

  // Resolve viewer role + product face at the active tenant. null = still
  // loading; during load we show CENTER items (the historical default)
  // optimistically so the layout doesn't flicker when context resolves.
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
    <motion.aside
      className="hidden lg:flex h-full flex-col border-r border-slate-100 bg-white"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* ── Brand ─────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900">
          <GraduationCap className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <motion.nav
        className="mt-4 flex flex-1 flex-col gap-1 px-3"
        variants={navContainerVariants}
        initial="hide"
        animate="show"
      >
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isBeta = !!item.betaFor?.includes(effectiveKind);

          // Shared inner row content — kept identical between the Link and
          // disabled-div branches so the visual layout stays in sync.
          const rowInner = (
            <>
              {isActive && !isBeta && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 rounded-xl bg-slate-50"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <item.icon className="relative z-10 h-[18px] w-[18px] shrink-0" />

              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    key={`label-${item.href}`}
                    variants={textVariants}
                    initial="hide"
                    animate="show"
                    exit="hide"
                    className="relative z-10 flex flex-1 items-center gap-2 overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                    {isBeta && (
                      <span
                        className="ml-auto rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200"
                        title="Tính năng đang phát triển — sắp ra mắt"
                      >
                        Beta
                      </span>
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
            </>
          );

          if (isBeta) {
            return (
              <motion.div key={item.href} variants={navItemVariants}>
                <div
                  aria-disabled="true"
                  title="Sắp ra mắt cho Trường học"
                  className="group relative flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300"
                >
                  {rowInner}
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div key={item.href} variants={navItemVariants}>
              <Link
                href={item.href}
                className={`
                  group relative flex items-center gap-3 rounded-xl px-3 py-2.5
                  text-sm font-medium transition-colors duration-150
                  ${
                    isActive
                      ? "text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }
                `}
              >
                {rowInner}
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* ── Collapse Toggle ───────────────────────────────── */}
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <ChevronsLeft className="h-[18px] w-[18px]" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                key="collapse-text"
                variants={textVariants}
                initial="hide"
                animate="show"
                exit="hide"
                className="overflow-hidden whitespace-nowrap"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
