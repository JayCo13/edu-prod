import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import type { ContactModuleT } from "@/lib/profile-schema";

// Inlined to avoid relying on icon names that may not exist in the pinned
// lucide-react version. Same shapes as the design prototype.
const SOCIAL_ICONS: Record<"fb" | "yt" | "tt", ReactNode> = {
  fb: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  yt: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M22 8s-.2-1.4-.8-2c-.7-.8-1.6-.8-2-.9C16 5 12 5 12 5s-4 0-7.2.1c-.4.1-1.3.1-2 .9C2.2 6.6 2 8 2 8S1.8 9.6 1.8 11.2v1.6C1.8 14.4 2 16 2 16s.2 1.4.8 2c.7.8 1.7.8 2.1.9 1.5.1 6.1.2 7.1.2 0 0 4 0 7.2-.2.4-.1 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.6C22.2 9.6 22 8 22 8z" />
      <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
    </svg>
  ),
  tt: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M19 7a4 4 0 0 1-4-4M9 14a4 4 0 1 0 4 4V3" />
    </svg>
  ),
};

interface ModuleContactProps {
  module: ContactModuleT;
}

export function ModuleContact({ module }: ModuleContactProps) {
  const { content: c } = module;
  return (
    <div className="bg-[#f5f5f5] px-6 py-12 sm:px-10 sm:py-16" id="contact">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--profile-accent)" }}
            >
              § Liên hệ
            </p>
            <h3 className="font-display mt-1.5 text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">
              Giữ liên lạc với cô.
            </h3>
          </div>
          <div className="space-y-3 lg:col-span-7">
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
                  <Mail className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    Email
                  </p>
                  <p className="truncate font-mono text-[13px] text-slate-900">
                    {c.email}
                  </p>
                </div>
                <span className="font-mono text-[10.5px] text-slate-400">↗</span>
              </a>
            )}
            {c.socials.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {c.socials.map((s) => (
                  <a
                    key={s.id}
                    href={`https://${s.handle}`}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-700">
                      {SOCIAL_ICONS[s.id]}
                    </span>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {s.label}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-700">
                      {s.handle.split("/")[1] ?? s.handle}
                    </p>
                  </a>
                ))}
              </div>
            )}
            {c.withCapture && (
              <form className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    Nhận tin mới
                  </p>
                  <input
                    name="email"
                    type="email"
                    placeholder="email@cua-ban.vn"
                    className="mt-0.5 w-full bg-transparent text-[13px] text-slate-900 placeholder-slate-400 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white"
                  style={{ background: "var(--profile-accent)" }}
                >
                  Đăng ký
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
