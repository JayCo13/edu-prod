import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getTenantBySlug,
  getTeacherPublishedCourses,
} from "@/app/actions/public";
import {
  getProfileLayoutBySlug,
  getTenantPublicStats,
} from "@/app/actions/profile";
import { PublicProfile } from "@/components/profile/PublicProfile";
import { DEFAULT_LAYOUT, SAMPLE_COURSES } from "@/components/profile/_sample";
import type { ProfileLayout } from "@/lib/profile-schema";

type PageProps = { params: Promise<{ slug: string }> };

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTenantBySlug(slug);
  if (!result.success || !result.data) return { title: "Không tìm thấy giáo viên" };

  const teacher = result.data;
  const displayName = teacher.owner?.display_name || teacher.name;
  const bio = teacher.owner?.bio || teacher.description || "";

  return {
    title: `Học trực tuyến cùng ${displayName} | ${teacher.name}`,
    description: bio.slice(0, 160) || `Khám phá các khóa học chất lượng từ ${displayName}.`,
    openGraph: {
      title: `${displayName} — ${teacher.name}`,
      description: bio.slice(0, 160),
      images: teacher.owner?.avatar_url ? [teacher.owner.avatar_url] : [],
    },
  };
}

export default async function TenantProfilePage({ params }: PageProps) {
  const { slug } = await params;

  const teacherResult = await getTenantBySlug(slug);

  // In dev, when Supabase is unreachable, fall back to the demo profile so
  // designers can iterate without a working DB. In prod, an unfetchable
  // tenant is a real 404.
  if (!teacherResult.success || !teacherResult.data) {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
      <PublicProfile
        layout={DEFAULT_LAYOUT}
        initials="TH"
        authorByline="Cô Trần Thị Hương · Hà Nội"
        courses={SAMPLE_COURSES}
      />
    );
  }

  const teacher = teacherResult.data;
  const displayName = teacher.owner?.display_name || teacher.name;
  const bio = teacher.owner?.bio || teacher.description || "";

  // Try to load saved layout; fall back to default. Both Supabase-down and
  // missing-column degrade gracefully via DEFAULT_LAYOUT.
  const layoutResult = await getProfileLayoutBySlug(slug);
  const baseLayout: ProfileLayout = layoutResult.success
    ? layoutResult.data
    : DEFAULT_LAYOUT;

  // Overlay real teacher data on top of whatever the saved/default layout has.
  // (Layout owns structure + variants + cosmetic content; tenant DB owns identity.)
  const layout: ProfileLayout = {
    ...baseLayout,
    modules: baseLayout.modules.map((m) => {
      if (m.type === "hero") {
        return {
          ...m,
          content: {
            ...m.content,
            name: displayName || m.content.name,
          },
        };
      }
      if (m.type === "about" && bio) {
        return { ...m, content: { ...m.content, body: bio } };
      }
      return m;
    }),
  };

  // Featured courses + aggregate stats — both real when available.
  const [coursesResult, statsResult] = await Promise.all([
    getTeacherPublishedCourses(teacher.id),
    getTenantPublicStats(teacher.id),
  ]);
  const realCourses = coursesResult.data ?? [];
  const realStats = statsResult.success ? statsResult.data : null;

  const courses =
    realCourses.length > 0
      ? realCourses.slice(0, 6).map((c, i) => {
          const hues = ["indigo", "amber", "rose", "emerald", "sky", "violet"] as const;
          const formatPrice = (n: number) =>
            n === 0
              ? "Miễn phí"
              : n.toLocaleString("vi-VN", {
                  style: "currency",
                  currency: c.currency || "VND",
                  maximumFractionDigits: 0,
                });
          return {
            id: i + 1,
            title: c.title,
            level: `${c.lessons_count ?? 0} bài`,
            price: formatPrice(c.price),
            oldPrice: null,
            students: c.enrollments_count ?? 0,
            // Intentionally no rating: no reviews/ratings system yet.
            // CourseCard hides the star + falls back to "Khóa mới" when both
            // rating and students are absent.
            hue: hues[i % hues.length],
          };
        })
      : SAMPLE_COURSES;

  return (
    <PublicProfile
      layout={layout}
      initials={initialsFrom(displayName)}
      authorByline={`${displayName} · ${teacher.name}`}
      courses={courses}
      stats={
        realStats
          ? {
              studentCount: realStats.studentCount,
              joinedAt: realStats.joinedAt,
            }
          : undefined
      }
    />
  );
}
