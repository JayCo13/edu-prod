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
  X,
  GraduationCap,
  Plus,
} from "lucide-react";

import { useSidebar } from "@/components/admin/sidebar-context";

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
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-semibold tracking-tight text-slate-900">
                  VLearning
                </span>
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

            {/* Quick Create */}
            <div className="mt-4 px-3">
              <Link
                href={QUICK_CREATE_HREF}
                onClick={closeMobile}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <Plus className="h-5 w-5" />
                Tạo buổi học Live
              </Link>
            </div>

            {/* Navigation */}
            <motion.nav
              className="mt-3 flex flex-1 flex-col gap-1 px-3"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

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
