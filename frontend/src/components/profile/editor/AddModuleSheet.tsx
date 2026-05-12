"use client";

import { Check, X } from "lucide-react";
import type { ModuleId } from "../_constants";

interface AddModuleSheetProps {
  alreadyAdded: ModuleId[];
  onAdd: (id: ModuleId) => void;
  onClose: () => void;
}

const OPTIONS: Array<{ id: ModuleId; title: string; sub: string }> = [
  { id: "hero", title: "Hero", sub: "Avatar · Tên · Tagline · CTA" },
  { id: "about", title: "About", sub: "Đôi lời tự giới thiệu · 1,500 ký tự" },
  { id: "featured", title: "Khóa học nổi bật", sub: "Chọn 3 — 6 khóa của bạn" },
  { id: "contact", title: "Liên hệ", sub: "Email · MXH · Nhận tin" },
];

function Thumb({ id }: { id: ModuleId }) {
  if (id === "hero") {
    return (
      <div className="absolute inset-0 flex items-center gap-2 px-4">
        <span className="h-12 w-9 rounded-md bg-gradient-to-br from-indigo-200 to-rose-200" />
        <div className="flex flex-col gap-1.5">
          <span className="h-1.5 w-16 rounded-full bg-slate-400" />
          <span className="h-1 w-12 rounded-full bg-slate-300" />
          <span
            className="mt-1 h-3 w-12 rounded"
            style={{ background: "var(--profile-accent)" }}
          />
        </div>
      </div>
    );
  }
  if (id === "about") {
    return (
      <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-6">
        <span className="h-1 w-2/3 rounded-full bg-slate-400" />
        <span className="h-1 w-full rounded-full bg-slate-300" />
        <span className="h-1 w-5/6 rounded-full bg-slate-300" />
        <span className="h-1 w-3/4 rounded-full bg-slate-300" />
      </div>
    );
  }
  if (id === "featured") {
    return (
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="flex h-14 flex-1 flex-col gap-1 rounded-md border border-slate-200 bg-white p-1.5"
          >
            <span className="h-5 rounded bg-gradient-to-br from-indigo-200 to-rose-200" />
            <span className="h-0.5 w-full rounded-full bg-slate-300" />
            <span className="h-0.5 w-2/3 rounded-full bg-slate-300" />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 px-4">
      <span className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2">
        <span className="h-3 w-3 rounded bg-slate-200" />
        <span className="h-1 w-12 rounded-full bg-slate-300" />
      </span>
      <span className="h-8 w-8 rounded-md border border-slate-200 bg-white" />
      <span className="h-8 w-8 rounded-md border border-slate-200 bg-white" />
    </div>
  );
}

export function AddModuleSheet({
  alreadyAdded,
  onAdd,
  onClose,
}: AddModuleSheetProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[640px] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Khối
            </p>
            <h3 className="font-display mt-0.5 text-[18px] font-bold text-slate-900">
              Thêm khối vào trang
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {OPTIONS.map((opt) => {
            const added = alreadyAdded.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !added && onAdd(opt.id)}
                disabled={added}
                className={`group relative overflow-hidden rounded-xl border bg-white text-left transition-all ${
                  added
                    ? "cursor-not-allowed border-slate-200 opacity-60"
                    : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="relative h-24 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                  <Thumb id={opt.id} />
                </div>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-900">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">
                      {opt.sub}
                    </p>
                  </div>
                  {added ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-500">
                      <Check className="h-3 w-3" /> Đã thêm
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-md font-mono text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--profile-accent)" }}
                    >
                      + Thêm
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <p className="font-mono text-[10.5px] uppercase tracking-wide text-slate-500">
            {alreadyAdded.length} / {OPTIONS.length} · Đã đầy đủ trong MVP
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
