"use client";

import { AlertTriangle, Check } from "lucide-react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface ActionBarProps {
  state: SaveState;
  moduleCount: number;
  errorText?: string;
  savedAt?: string;
  onSave: () => void;
  onPublish: () => void;
}

function StateLine({
  state,
  moduleCount,
  errorText,
  savedAt,
}: Pick<ActionBarProps, "state" | "moduleCount" | "errorText" | "savedAt">) {
  if (state === "saving") {
    return (
      <>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Đang lưu…
      </>
    );
  }
  if (state === "saved") {
    return (
      <>
        <span style={{ color: "var(--profile-accent)" }}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        Đã lưu {savedAt ? `· ${savedAt}` : ""}
      </>
    );
  }
  if (state === "error") {
    return (
      <>
        <span className="text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-rose-600">
          {errorText || "Có lỗi cần sửa trước khi xuất bản"}
        </span>
      </>
    );
  }
  if (state === "dirty") {
    return (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Có thay đổi chưa lưu · {moduleCount} khối
      </>
    );
  }
  return (
    <>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      {moduleCount} khối
    </>
  );
}

export function ActionBar({
  state,
  moduleCount,
  errorText,
  savedAt,
  onSave,
  onPublish,
}: ActionBarProps) {
  const disabled = state === "error" || state === "saving";
  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
      <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-600">
        <StateLine
          state={state}
          moduleCount={moduleCount}
          errorText={errorText}
          savedAt={savedAt}
        />
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Lưu nháp
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={disabled}
          className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--profile-accent)" }}
        >
          Xuất bản
        </button>
      </div>
    </footer>
  );
}
