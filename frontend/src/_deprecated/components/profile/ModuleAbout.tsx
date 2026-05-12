import type { AboutModuleT } from "@/lib/profile-schema";

interface ModuleAboutProps {
  module: AboutModuleT;
  authorByline?: string;
}

export function ModuleAbout({
  module,
  authorByline = "Cô Hương · Hà Nội · MMXXVI",
}: ModuleAboutProps) {
  const { content: c } = module;
  return (
    <div className="bg-[#f5f5f5] px-6 py-14 sm:px-10 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--profile-accent)" }}
        >
          § Giới thiệu
        </p>
        <h2 className="font-display mt-2 text-[30px] font-bold tracking-[-0.02em] text-slate-900 sm:text-[40px]">
          Đôi lời từ cô.
        </h2>
        <p className="mt-6 text-[16px] leading-[1.75] text-slate-700 sm:text-[17px]">
          {c.body}
        </p>
        {c.withQuote && c.quote && (
          <blockquote
            className="font-display mt-10 border-l-2 pl-5 text-[20px] italic leading-snug text-slate-800 sm:text-[24px]"
            style={{ borderColor: "var(--profile-accent)" }}
          >
            &ldquo;{c.quote}&rdquo;
            <footer className="mt-3 font-mono text-[10.5px] not-italic uppercase tracking-[0.14em] text-slate-500">
              — {authorByline}
            </footer>
          </blockquote>
        )}
      </div>
    </div>
  );
}
