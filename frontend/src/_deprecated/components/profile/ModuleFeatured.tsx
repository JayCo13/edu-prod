import { ArrowRight } from "lucide-react";
import { CourseCard } from "./CourseCard";
import { SAMPLE_COURSES, type SampleCourse } from "./_sample";
import type { FeaturedModuleT } from "@/lib/profile-schema";

interface ModuleFeaturedProps {
  module: FeaturedModuleT;
  courses?: SampleCourse[];
}

export function ModuleFeatured({
  module,
  courses = SAMPLE_COURSES,
}: ModuleFeaturedProps) {
  const { variant, content: c } = module;
  const picked = c.courseIds.length > 0 ? c.courseIds : [1, 2, 3];
  const list = courses.filter((course) => picked.includes(course.id));

  return (
    <div className="bg-white px-6 py-14 sm:px-10 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--profile-accent)" }}
            >
              § Khóa học nổi bật
            </p>
            <h2 className="font-display mt-2 text-[30px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[40px]">
              Cùng cô bắt đầu.
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-700 hover:text-slate-900"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </a>
        </div>
        {variant === "grid3" ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {list.slice(0, 2).map((course) => (
              <CourseCard key={course.id} course={course} large />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
