import { ArrowUpRight, Play, Star } from "lucide-react";
import type { SampleCourse } from "./_sample";

const HUE_MAP: Record<SampleCourse["hue"], string> = {
  indigo: "from-indigo-100 to-violet-100",
  amber: "from-amber-100 to-orange-100",
  rose: "from-rose-100 to-pink-100",
  emerald: "from-emerald-100 to-teal-100",
  sky: "from-sky-100 to-cyan-100",
  violet: "from-violet-100 to-fuchsia-100",
};

interface CourseCardProps {
  course: SampleCourse;
  large?: boolean;
}

export function CourseCard({ course, large = false }: CourseCardProps) {
  const isFree = course.price.includes("Miễn");
  const patternId = `cc-${course.id}`;
  const padding = large ? "p-6" : "p-5";

  return (
    <a
      href="#"
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      <div
        className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${HUE_MAP[course.hue]}`}
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 400 250"
          aria-hidden
        >
          <defs>
            <pattern
              id={patternId}
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M14 0L0 0 0 14"
                fill="none"
                stroke="rgba(15,23,42,0.1)"
              />
            </pattern>
          </defs>
          <rect width="400" height="250" fill={`url(#${patternId})`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-display font-black tracking-tight text-slate-900/15 ${
              large ? "text-[130px]" : "text-[88px]"
            }`}
          >
            {String(course.id).padStart(2, "0")}
          </span>
        </div>
        {course.live && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-white">
            <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
            Live
          </div>
        )}
        {course.featured && !course.live && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-amber-950">
            ★ Nổi bật
          </div>
        )}
        <div className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-900">
          <Play className="h-3.5 w-3.5" fill="currentColor" />
        </div>
      </div>
      <div className={padding}>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {course.level}
        </p>
        <h3
          className={`font-display mt-2 font-semibold tracking-tight text-slate-900 ${
            large ? "text-[20px]" : "text-[17px]"
          }`}
        >
          {course.title}
        </h3>
        <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] text-slate-500">
          {course.rating !== undefined && course.rating > 0 && (
            <>
              <span className="inline-flex items-center gap-1 text-amber-500">
                <Star className="h-3 w-3" fill="currentColor" />
                <span className="font-bold tabular-nums text-slate-700">
                  {course.rating}
                </span>
              </span>
              {course.students > 0 && (
                <span className="h-1 w-1 rounded-full bg-slate-300" />
              )}
            </>
          )}
          {course.students > 0 && (
            <span className="tabular-nums">
              {course.students.toLocaleString("vi-VN")} học viên
            </span>
          )}
          {!(course.rating && course.rating > 0) && course.students === 0 && (
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              Khóa mới
            </span>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
          <div>
            {course.oldPrice && (
              <p className="font-mono text-[10px] tabular-nums text-slate-400 line-through">
                {course.oldPrice}
              </p>
            )}
            <p
              className={`font-display font-bold tabular-nums ${
                isFree ? "text-emerald-600" : "text-slate-900"
              } ${large ? "text-[20px]" : "text-[17px]"}`}
            >
              {course.price}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--profile-accent)" }}
          >
            Xem <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}
