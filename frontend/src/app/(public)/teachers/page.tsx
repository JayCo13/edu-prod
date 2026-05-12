import type { Metadata } from "next";
import { getPublicTeachers } from "@/app/actions/public";
import TeacherGrid from "@/components/marketplace/teacher-grid";

/**
 * Teachers Directory Page (SEO Marketplace)
 * ==========================================
 * Server Component — renders teacher list for public discovery.
 * Fetches all public tenants with SEO-optimized metadata.
 */

export const metadata: Metadata = {
  title: "Khám phá Giáo viên — VLearning Marketplace",
  description:
    "Tìm kiếm giáo viên uy tín trên VLearning. Đăng ký học trực tuyến với các chuyên gia hàng đầu trong lĩnh vực của họ.",
  openGraph: {
    title: "Khám phá Giáo viên — VLearning Marketplace",
    description:
      "Tìm kiếm giáo viên uy tín trên VLearning. Đăng ký học trực tuyến với các chuyên gia hàng đầu.",
  },
};

export default async function TeachersDirectoryPage() {
  const result = await getPublicTeachers();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Marketplace
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Khám phá giáo viên
        </h1>
        <p className="mt-4 text-lg text-slate-500">
          Tìm giáo viên phù hợp và bắt đầu hành trình học tập của bạn.
        </p>
      </div>

      {/* Teacher Grid */}
      <div className="mt-12">
        <TeacherGrid teachers={result.data || []} />
      </div>
    </div>
  );
}
