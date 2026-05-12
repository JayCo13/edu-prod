import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar as CalendarIcon, Video } from "lucide-react";

import { getTenantBySlug } from "@/app/actions/public";
import { getStudentUpcomingLiveSessions } from "@/app/actions/live-sessions";
import { createClient } from "@/lib/supabase/server";
import { StudentSessionCard } from "./_components/StudentSessionCard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Lịch học Live · ${slug}` };
}

export default async function StudentLiveListPage({ params }: PageProps) {
  const { slug } = await params;

  const tenantResult = await getTenantBySlug(slug);
  if (!tenantResult.success || !tenantResult.data) notFound();
  const tenant = tenantResult.data;

  // Auth gate: the page is meaningless when logged out.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/live`);
  }

  const sessionsResult = await getStudentUpcomingLiveSessions(slug);
  const sessions = (sessionsResult.success && sessionsResult.data) || [];

  const now = Date.now();
  const live = sessions.filter((s) => {
    const start = new Date(s.start_time).getTime();
    const end = start + s.duration_minutes * 60 * 1000;
    return now >= start && now <= end;
  });
  const upcoming = sessions.filter(
    (s) => new Date(s.start_time).getTime() > now,
  );
  const recent = sessions.filter((s) => {
    const start = new Date(s.start_time).getTime();
    const end = start + s.duration_minutes * 60 * 1000;
    return now > end;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3 w-3" />
          Về trang chủ
        </Link>
        <header className="mt-4">
          <p
            className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500"
          >
            § Lớp Live · {tenant.name}
          </p>
          <h1 className="font-display mt-2 text-[32px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[40px]">
            Lịch học của bạn
          </h1>
          <p className="mt-2 text-[14px] text-slate-600">
            Các buổi học Live thuộc khóa bạn đã đăng ký. Liên kết phòng họp
            được mở cho bạn 15 phút trước giờ bắt đầu.
          </p>
        </header>

        {sessions.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Video className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-[14px] font-medium text-slate-700">
              Chưa có buổi học nào sắp tới
            </p>
            <p className="mt-1 max-w-xs text-center text-[12px] text-slate-500">
              Khi giáo viên lên lịch buổi học mới, lớp sẽ xuất hiện ở đây
              ngay.
            </p>
            {/* [DEPRECATED per PRD §4.3] - hidden 2026-05-12
                Linked to public courses storefront; LMS out of scope.
            <Link
              href="/courses"
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 hover:text-slate-900"
            >
              <CalendarIcon className="h-3 w-3" />
              Xem tất cả khóa học
            </Link>
            */}
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {live.length > 0 && (
              <Section label="Đang diễn ra" count={live.length} accent="rose">
                {live.map((s) => (
                  <StudentSessionCard
                    key={s.id}
                    session={s}
                    tenantSlug={slug}
                  />
                ))}
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section label="Sắp tới" count={upcoming.length}>
                {upcoming.map((s) => (
                  <StudentSessionCard
                    key={s.id}
                    session={s}
                    tenantSlug={slug}
                  />
                ))}
              </Section>
            )}
            {recent.length > 0 && (
              <Section label="Vừa kết thúc" count={recent.length}>
                {recent.map((s) => (
                  <StudentSessionCard
                    key={s.id}
                    session={s}
                    tenantSlug={slug}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  count,
  accent,
  children,
}: {
  label: string;
  count: number;
  accent?: "rose";
  children: React.ReactNode;
}) {
  const labelColor = accent === "rose" ? "text-rose-600" : "text-slate-500";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2
          className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] ${labelColor}`}
        >
          {label}
        </h2>
        <span className="font-mono text-[10px] tabular-nums text-slate-400">
          {count}
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {children}
    </section>
  );
}
