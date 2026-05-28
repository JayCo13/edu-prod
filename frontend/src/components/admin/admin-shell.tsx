"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

import { SidebarProvider } from "@/components/admin/sidebar-context";
import AnimatedSidebar from "@/components/admin/animated-sidebar";
import MobileSidebar from "@/components/admin/mobile-sidebar";
import TopNavbar from "@/components/admin/top-navbar";
import { FeatureIntro } from "@/components/admin/feature-intro";
import ToastProvider from "@/components/ui/toast-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

/**
 * AdminShell (Client Component)
 * ==============================
 * The visual shell for the admin dashboard.
 * Auth gating is handled by the Server Component wrapper (layout.tsx).
 */

const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ConfirmDialogProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <AnimatedSidebar />
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopNavbar />
            <motion.main
              className="flex-1 overflow-y-auto p-4 lg:p-8"
              variants={pageTransition}
              initial="initial"
              animate="animate"
            >
              <FeatureIntro />
              {children}
            </motion.main>
          </div>
        </div>
        <ToastProvider />
      </ConfirmDialogProvider>
    </SidebarProvider>
  );
}
