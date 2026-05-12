import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTeacherBySlug } from "@/app/actions/public";
import TeacherProfile from "@/components/marketplace/teacher-profile";

/**
 * Teacher Detail Page (SEO-optimized)
 * ====================================
 * Server Component with dynamic metadata via generateMetadata.
 * Fetches teacher data and passes to TeacherProfile client component.
 *
 * CTA: "Đăng ký học ngay" redirects to [slug].ticoclass.com/register
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ── Dynamic SEO Metadata ───────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTeacherBySlug(slug);

  if (!result.success || !result.data) {
    return { title: "Giáo viên không tìm thấy" };
  }

  const teacher = result.data;
  const displayName = teacher.owner?.display_name || teacher.name;
  const description =
    teacher.description || teacher.owner?.bio || `Khám phá khóa học từ ${displayName} trên VLearning`;

  return {
    title: `${displayName} — Giáo viên trên VLearning`,
    description,
    openGraph: {
      title: `${displayName} — Giáo viên trên VLearning`,
      description,
      type: "profile",
    },
  };
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function TeacherProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getTeacherBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  return <TeacherProfile teacher={result.data} />;
}
