"use client";

import { motion } from "framer-motion";
import {
  Users,
  BookOpen,
  TrendingUp,
  ArrowUpRight,
  FileEdit,
  BarChart3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

/**
 * DashboardGrid (Client Component)
 * =================================
 * Bento Grid with staggered animation.
 * Data is passed as props from Server Component (no client fetch).
 */

// ── Animation Variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const hoverSpring = {
  scale: 1.01,
  transition: { type: "spring" as const, stiffness: 300, damping: 20 },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardGridProps {
  userName: string;
  courseStats: {
    total: number;
    published: number;
    draft: number;
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardGrid({
  userName,
  courseStats,
}: DashboardGridProps) {
  const stats = [
    {
      label: "Tổng doanh thu",
      value: "₫0",
      subtitle: "Tháng này",
      icon: TrendingUp,
      accent: "text-amber-600",
      accentBg: "bg-amber-50",
      href: null,
    },
    {
      label: "Tổng học sinh",
      value: "0",
      subtitle: "Đã đăng ký",
      icon: Users,
      accent: "text-indigo-600",
      accentBg: "bg-indigo-50",
      href: null,
    },
    {
      label: "Khóa học hoạt động",
      value: courseStats.published.toString(),
      subtitle: `${courseStats.draft} bản nháp · ${courseStats.total} tổng`,
      icon: BookOpen,
      accent: "text-emerald-600",
      accentBg: "bg-emerald-50",
      href: "/dashboard/courses",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Page Header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tổng quan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Xin chào,{" "}
          <span className="font-medium text-slate-700">{userName}</span>! Đây là
          bảng điều khiển của bạn.
        </p>
      </motion.div>

      {/* ── Bento Grid — Stat Cards ─────────────────────────── */}
      <motion.div
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {stats.map((stat) => {
          const Card = (
            <motion.div
              key={stat.label}
              variants={cardVariants}
              whileHover={hoverSpring}
              className="group cursor-default rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.accentBg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.accent}`} />
                </div>
                {stat.href && (
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-indigo-600">
                    Xem chi tiết
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {stat.value}
                </p>
              </div>

              {/* Footer */}
              <div className="mt-5 border-t border-slate-50 pt-4">
                <p className="text-xs text-slate-400">{stat.subtitle}</p>
              </div>
            </motion.div>
          );

          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="block">
              {Card}
            </Link>
          ) : (
            Card
          );
        })}
      </motion.div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <motion.div
        className="grid gap-4 sm:grid-cols-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
      >
        <Link
          href="/dashboard/courses"
          className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-slate-200 hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-slate-900">
            <BookOpen className="h-5 w-5 text-slate-500 transition-colors group-hover:text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Quản lý khóa học
            </p>
            <p className="text-xs text-slate-400">
              Tạo, sửa và xuất bản khóa học
            </p>
          </div>
        </Link>

        <div className="group flex items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
            <FileEdit className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">
              Tạo bài giảng
            </p>
            <p className="text-xs text-slate-300">Sắp ra mắt</p>
          </div>
        </div>

        <div className="group flex items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
            <BarChart3 className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">
              Phân tích dữ liệu
            </p>
            <p className="text-xs text-slate-300">Sắp ra mắt</p>
          </div>
        </div>
      </motion.div>

      {/* ── Activity Section ────────────────────────────────── */}
      <motion.section
        className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Hoạt động gần đây
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Chưa có hoạt động nào. Hãy bắt đầu bằng cách{" "}
          <Link
            href="/dashboard/courses"
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            tạo khóa học đầu tiên
          </Link>
          .
        </p>
      </motion.section>
    </div>
  );
}
