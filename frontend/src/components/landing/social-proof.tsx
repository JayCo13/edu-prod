/**
 * Trust strip — 4 stats below the hero. Ported from the design bundle.
 *
 * Numbers are illustrative target metrics, not live data. Update them by
 * editing this file directly.
 */
const STATS: { v: string; suffix?: string; l: string }[] = [
  { v: "127", l: "Trung tâm đang dùng" },
  { v: "1.840", l: "Giáo viên đang active" },
  { v: "48", suffix: "tỷ đ", l: "Lương đã xử lý" },
  { v: "99,98%", l: "Uptime 12 tháng" },
];

export default function SocialProof() {
  return (
    <section className="border-y border-slate-100 bg-[#f5f5f5] py-10">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-6 sm:grid-cols-4 lg:px-10">
        {STATS.map((s, i) => (
          <div
            key={i}
            className={`px-2 ${i > 0 ? "sm:border-l sm:border-slate-200" : ""}`}
          >
            <p className="font-display text-[28px] font-bold tracking-tight tabular-nums text-slate-900 sm:text-[32px]">
              {s.v}
              {s.suffix && (
                <span className="font-mono text-[13px] font-medium text-slate-400">
                  {" "}
                  {s.suffix}
                </span>
              )}
            </p>
            <p className="mt-1 text-[12.5px] font-medium text-slate-500">
              {s.l}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
