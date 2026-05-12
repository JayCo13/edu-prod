"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  UserCog,
  BarChart3,
  Settings,
  ChevronsLeft,
  GraduationCap,
  Plus,
} from "lucide-react";

import { useSidebar } from "@/components/admin/sidebar-context";

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

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/dashboard/courses", icon: BookOpen },
  { label: "Lịch dạy", href: "/dashboard/calendar", icon: Calendar },
  { label: "Giáo viên", href: "/dashboard/teachers", icon: UserCog },
  { label: "Students", href: "/dashboard/students", icon: Users },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Trang cá nhân", href: "/dashboard/profile", icon: Settings },
];

const QUICK_CREATE_HREF = "/dashboard/calendar?create=1";

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

  return (
    <motion.aside
      className="hidden lg:flex h-full flex-col border-r border-slate-100 bg-white"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* ── Brand ─────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900">
          <GraduationCap className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              key="brand-text"
              variants={textVariants}
              initial="hide"
              animate="show"
              exit="hide"
              className="overflow-hidden whitespace-nowrap text-base font-semibold tracking-tight text-slate-900"
            >
              VLearning
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Quick Create — opens the schedule modal from anywhere ── */}
      <div className="mt-4 px-3">
        <Link
          href={QUICK_CREATE_HREF}
          title={isCollapsed ? "Tạo buổi học Live" : undefined}
          className={`group flex items-center gap-2 rounded-xl bg-slate-900 text-white shadow-sm transition-opacity hover:opacity-90 ${
            isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          }`}
        >
          <Plus className="h-[18px] w-[18px] shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                key="quick-create-text"
                variants={textVariants}
                initial="hide"
                animate="show"
                exit="hide"
                className="overflow-hidden whitespace-nowrap text-sm font-semibold"
              >
                Tạo buổi học Live
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <motion.nav
        className="mt-4 flex flex-1 flex-col gap-1 px-3"
        variants={navContainerVariants}
        initial="hide"
        animate="show"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

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
                {/* Active Indicator — slides between items via layoutId */}
                {isActive && (
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
                      className="relative z-10 overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
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
