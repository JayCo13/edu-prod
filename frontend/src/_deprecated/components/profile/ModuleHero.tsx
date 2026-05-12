import { ArrowUpRight } from "lucide-react";
import { Portrait } from "./Portrait";
import type { HeroModuleT } from "@/lib/profile-schema";

export interface HeroStats {
  studentCount?: number;
  joinedAt?: string | null;
}

interface ModuleHeroProps {
  module: HeroModuleT;
  initials?: string;
  stats?: HeroStats;
}

function formatStudents(n: number): string {
  return n.toLocaleString("vi-VN");
}

function formatJoinedSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Tham gia ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface CompactPillsProps {
  studentCount?: number;
  experienceYears: string;
  location: string;
  joinedFallback?: string | null;
}

function CompactPills({
  studentCount,
  experienceYears,
  location,
  joinedFallback,
}: CompactPillsProps) {
  const items: string[] = [];
  if (studentCount && studentCount > 0) {
    items.push(`${formatStudents(studentCount)} học viên`);
  }
  if (experienceYears) items.push(experienceYears + " kinh nghiệm");
  if (location) items.push(location);
  // Cold-start: nothing platform-verified, nothing self-claimed → show a
  // honest "newly joined" pill so the row still has presence.
  if (items.length === 0 && joinedFallback) items.push(joinedFallback);
  if (items.length === 0) return null;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
      {items.map((t, i) => (
        <span key={t} className="inline-flex items-center gap-2">
          {i > 0 && <span className="h-1 w-1 rounded-full bg-slate-300" />}
          <span>{t}</span>
        </span>
      ))}
    </div>
  );
}

export function ModuleHero({
  module,
  initials = "TH",
  stats,
}: ModuleHeroProps) {
  const { variant, content: c } = module;
  const joinedFallback = formatJoinedSince(stats?.joinedAt);
  const studentCount = stats?.studentCount;

  // Inline stats (split variant) — only render the cells that have data.
  const inlineCells: Array<{ value: string; label: string }> = [];
  if (studentCount && studentCount > 0) {
    inlineCells.push({ value: formatStudents(studentCount), label: "học viên" });
  }
  if (c.experienceYears) {
    inlineCells.push({ value: c.experienceYears, label: "kinh nghiệm" });
  }
  if (c.achievement) {
    // Render achievement as the third inline cell — short label as bold,
    // longer phrasing as the descriptor.
    inlineCells.push({ value: "Thành tích", label: c.achievement });
  }
  if (inlineCells.length === 0 && joinedFallback) {
    inlineCells.push({ value: joinedFallback, label: "Mới gia nhập" });
  }

  if (variant === "centered") {
    return (
      <div className="bg-white px-6 py-16 text-center sm:px-10 sm:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <Portrait initials={initials} size="lg" />
          {c.role && (
            <p className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              — {c.role}
            </p>
          )}
          <h1 className="font-display mt-3 text-[44px] font-bold leading-[1] tracking-[-0.025em] text-slate-900 sm:text-[60px]">
            {c.name}
          </h1>
          {c.tagline && (
            <p className="mt-5 max-w-md text-[16px] leading-[1.55] text-slate-600 sm:text-[18px]">
              {c.tagline}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={c.primaryCtaHref}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-semibold text-white"
              style={{ background: "var(--profile-accent)" }}
            >
              {c.primaryCtaLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            {c.secondaryCtaLabel && (
              <a
                href={c.secondaryCtaHref}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                {c.secondaryCtaLabel}
              </a>
            )}
          </div>
          <CompactPills
            studentCount={studentCount}
            experienceYears={c.experienceYears}
            location={c.location}
            joinedFallback={joinedFallback}
          />
        </div>
      </div>
    );
  }

  // Split variant
  return (
    <div className="bg-white px-6 py-12 sm:px-10 sm:py-20">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <Portrait initials={initials} square />
        </div>
        <div className="lg:col-span-7">
          {c.role && (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              — {c.role}
            </p>
          )}
          <h1 className="font-display mt-3 text-[44px] font-bold leading-[0.98] tracking-[-0.025em] text-slate-900 sm:text-[64px]">
            {c.name}
          </h1>
          {c.tagline && (
            <p className="mt-5 max-w-md text-[16px] leading-[1.55] text-slate-600 sm:text-[18px]">
              {c.tagline}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={c.primaryCtaHref}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-semibold text-white"
              style={{ background: "var(--profile-accent)" }}
            >
              {c.primaryCtaLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            {c.secondaryCtaLabel && (
              <a
                href={c.secondaryCtaHref}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                {c.secondaryCtaLabel}
              </a>
            )}
          </div>
          {inlineCells.length > 0 && (
            <div
              className={`mt-7 grid max-w-sm divide-x divide-slate-200 border-y border-slate-200`}
              style={{
                gridTemplateColumns: `repeat(${inlineCells.length}, minmax(0, 1fr))`,
              }}
            >
              {inlineCells.map((cell, i) => (
                <div key={i} className="px-3 py-3">
                  <p className="font-display text-[20px] font-bold tabular-nums text-slate-900">
                    {cell.value}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                    {cell.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
