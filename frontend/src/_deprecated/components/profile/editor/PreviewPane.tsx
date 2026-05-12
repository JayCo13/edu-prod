"use client";

import { useState } from "react";
import { PublicProfile } from "../PublicProfile";
import type { ProfileLayout } from "@/lib/profile-schema";

interface PreviewPaneProps {
  layout: ProfileLayout;
  subdomain?: string;
}

export function PreviewPane({
  layout,
  subdomain = "cohuong",
}: PreviewPaneProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const scale = viewport === "desktop" ? 0.62 : 0.85;

  return (
    <div className="relative flex h-full flex-1 flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{subdomain}.ticoclass.com</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-400">live preview</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide transition-colors ${
              viewport === "desktop"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide transition-colors ${
              viewport === "mobile"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
            }`}
          >
            Mobile
          </button>
          <span className="ml-2 font-mono text-[10px] tabular-nums text-slate-400">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-5">
        <div
          className={`relative mx-auto h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
            viewport === "mobile" ? "max-w-[420px]" : ""
          }`}
        >
          <div
            className="origin-top-left overflow-y-auto"
            style={{
              transform: `scale(${scale})`,
              width: `calc(100% / ${scale})`,
              height: `calc(100% / ${scale})`,
            }}
          >
            <PublicProfile layout={layout} />
          </div>
        </div>
      </div>
    </div>
  );
}
