"use client";

import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { buildTenantUrl } from "@/lib/tenant-context";
import type { PublicTeacher } from "@/app/actions/public";

/**
 * TeacherProfile
 * ==============
 * Client component for the teacher detail page.
 * Renders profile info and the critical "Đăng ký học ngay" CTA
 * that redirects to the teacher's subdomain.
 */

interface TeacherProfileProps {
  teacher: PublicTeacher;
}

export default function TeacherProfile({ teacher }: TeacherProfileProps) {
  const registerUrl = buildTenantUrl(teacher.subdomain, "/register");
  const displayName = teacher.owner?.display_name || teacher.name;
  const bio = teacher.owner?.bio || teacher.description || "Chưa có mô tả.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      {/* ── Profile Header ─────────────────────────────────── */}
      <motion.div
        className="flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        {/* Avatar */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-3xl font-bold text-white shadow-lg">
          {displayName.charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
          {displayName}
        </h1>

        {/* Subdomain */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
          <ExternalLink className="h-3.5 w-3.5" />
          {teacher.subdomain}.ticoclass.com
        </p>

        {/* Bio */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-500">
          {bio}
        </p>

        {/* ── CTA Button — Redirect to subdomain ─────────── */}
        <motion.a
          href={registerUrl}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-shadow hover:shadow-xl hover:shadow-slate-900/30"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Đăng ký học ngay
          <ArrowRight className="h-4 w-4" />
        </motion.a>
      </motion.div>

      {/* ── Courses Section (placeholder) ──────────────────── */}
      <motion.section
        className="mt-16"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" as const }}
      >
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Khóa học
        </h2>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            Các khóa học sẽ được hiển thị ở đây khi giáo viên xuất bản.
          </p>
        </div>
      </motion.section>
    </div>
  );
}
