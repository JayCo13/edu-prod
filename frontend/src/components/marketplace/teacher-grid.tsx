"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GraduationCap, Users, ArrowRight } from "lucide-react";

import type { PublicTeacher } from "@/app/actions/public";

/**
 * TeacherGrid
 * ===========
 * Client component for animated teacher card grid.
 * Uses whileInView stagger entrance + hover spring.
 */

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

interface TeacherGridProps {
  teachers: PublicTeacher[];
}

export default function TeacherGrid({ teachers }: TeacherGridProps) {
  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <GraduationCap className="h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Chưa có giáo viên nào
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Hãy là người đầu tiên tạo học viện trên nền tảng.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {teachers.map((teacher) => (
        <motion.div key={teacher.id} variants={cardVariants}>
          <Link
            href={`/teachers/${teacher.subdomain}`}
            className="group block rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md"
          >
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-bold text-white">
                {(teacher.owner?.display_name || teacher.name)
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-900">
                  {teacher.owner?.display_name || teacher.name}
                </h3>
                <p className="truncate text-sm text-slate-400">
                  {teacher.subdomain}.ticoclass.com
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-500">
              {teacher.description || teacher.owner?.bio || "Chưa có mô tả"}
            </p>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-50 pt-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5" />
                Học viện
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors group-hover:text-indigo-700">
                Xem chi tiết
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
