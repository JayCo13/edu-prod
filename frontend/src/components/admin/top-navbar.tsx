"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  ChevronRight,
  LogOut,
  User,
  ShieldCheck,
  GraduationCap,
  School,
  Building2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSidebar } from "@/components/admin/sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import NotificationsBell from "@/components/admin/notifications-bell";
import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";

/**
 * TopNavbar
 * =========
 * Top navigation bar with:
 *   - Hamburger menu button (mobile only)
 *   - Auto-generated breadcrumbs from pathname
 *   - Notification bell with subtle hover animation
 *   - Avatar dropdown: profile info, "Hồ sơ", "Đăng xuất"
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
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // null = still loading; the badge stays hidden so we don't briefly flash
  // the wrong role for a quick teacher → admin switch.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Product face — added migration 0031. SCHOOL renders a separate badge
  // next to the role pill so users always know which face they're in.
  const [kind, setKind] = useState<"CENTER" | "SCHOOL" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          (user.user_metadata?.display_name as string) ||
          user.email ||
          "Người dùng";
        setDisplayName(name);
        setEmail(user.email ?? "");
        setInitials(name.substring(0, 2).toUpperCase());
      }
    });
    // Resolve the user's role + product face at this tenant via the existing
    // tenant-context server action (handles both owner + tenant_teachers paths).
    getCurrentTenantContextForClient().then((r) => {
      if (r.success && r.data) {
        setIsAdmin(r.data.isAdmin);
        setKind(r.data.kind);
      }
    });
  }, []);

  // Click-outside + Esc to close the avatar dropdown.
  useEffect(() => {
    if (!isMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <motion.header
      className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-slate-100 bg-white/80 px-4 backdrop-blur-md print:hidden lg:px-6"
      data-tkb-chrome="true"
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
        {/* Notification bell — real list + mark-read, polled every 30s. */}
        <NotificationsBell />

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-slate-100" />

        {/* Role + product-face badges. Visible on >= sm screens; the user
            dropdown re-surfaces the same pair on mobile. */}
        {kind !== null && (
          <KindBadge kind={kind} className="hidden sm:inline-flex" />
        )}
        {isAdmin !== null && (
          <RoleBadge isAdmin={isAdmin} className="hidden sm:inline-flex" />
        )}

        {/* Avatar + Dropdown */}
        <div ref={menuRef} className="relative">
          <motion.button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-semibold text-white shadow-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            aria-label="Mở menu người dùng"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            {initials || "U"}
          </motion.button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="absolute right-0 top-11 z-50 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              >
                {/* User info */}
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      Đang đăng nhập
                    </p>
                    <div className="flex items-center gap-1">
                      {kind !== null && <KindBadge kind={kind} />}
                      {isAdmin !== null && <RoleBadge isAdmin={isAdmin} />}
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {displayName || "Người dùng"}
                  </p>
                  {email && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {email}
                    </p>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Hồ sơ &amp; cài đặt
                  </Link>
                </div>

                <div className="border-t border-slate-100 py-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

/** Product-face pill — distinguishes CENTER (trung tâm dạy thêm, emerald)
 *  from SCHOOL (tiện ích trường học, cyan). Chosen by the owner during
 *  onboarding and stored on `tenants.kind` (migration 0031). */
function KindBadge({
  kind,
  className = "",
}: {
  kind: "CENTER" | "SCHOOL";
  className?: string;
}) {
  if (kind === "SCHOOL") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-inset ring-cyan-100 ${className}`}
        title="Tài khoản này dùng giao diện Trường học (Thời khoá biểu mẫu)"
      >
        <School className="h-3 w-3" />
        Trường học
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-100 ${className}`}
      title="Tài khoản này dùng giao diện Trung tâm dạy thêm (Bảng lương + Lịch dạy)"
    >
      <Building2 className="h-3 w-3" />
      Trung tâm
    </span>
  );
}

/** Role pill — "Quản trị" (indigo) for admins, "Giáo viên" (slate) for
 *  teachers. Source-of-truth is getCurrentTenantContextForClient (tenant
 *  owner OR is_admin tenant_teacher → admin). */
function RoleBadge({
  isAdmin,
  className = "",
}: {
  isAdmin: boolean;
  className?: string;
}) {
  if (isAdmin) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-100 ${className}`}
        title="Bạn là quản trị viên của trung tâm này"
      >
        <ShieldCheck className="h-3 w-3" />
        Quản trị
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200 ${className}`}
      title="Bạn là giáo viên tại trung tâm này"
    >
      <GraduationCap className="h-3 w-3" />
      Giáo viên
    </span>
  );
}
