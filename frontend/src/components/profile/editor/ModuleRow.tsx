"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { DragHandle } from "./_dnd";

interface ModuleRowProps {
  index: number;
  icon: ReactNode;
  title: string;
  sub: string;
  hidden?: boolean;
  required?: boolean;
  dragging?: boolean;
  dropAbove?: boolean;
  onClick?: () => void;
  onToggleVisible?: () => void;
  onDelete?: () => void;
}

export function ModuleRow({
  index,
  icon,
  title,
  sub,
  hidden = false,
  required = false,
  dragging = false,
  dropAbove = false,
  onClick,
  onToggleVisible,
  onDelete,
}: ModuleRowProps) {
  const stateCls = hidden ? "opacity-50" : "";
  const dragCls = dragging
    ? "scale-[0.99] opacity-40 ring-1 ring-indigo-300"
    : "";

  return (
    <div className="relative">
      {dropAbove && (
        <div
          className="absolute -top-1.5 left-0 right-0 h-1 rounded-full"
          style={{ background: "var(--profile-accent)" }}
        />
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        className={`relative cursor-pointer rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 ${stateCls} ${dragCls}`}
      >
        <div className="flex items-center gap-3 px-3 py-3">
          <DragHandle />
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide tabular-nums text-slate-400">
                {String(index).padStart(2, "0")}
              </p>
              <p className="truncate text-[13.5px] font-semibold text-slate-900">
                {title}
              </p>
              {hidden && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-slate-500">
                  Ẩn
                </span>
              )}
              {required && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-slate-500">
                  Bắt buộc
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">
              {sub}
            </p>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible?.();
              }}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100 hover:text-slate-700"
              aria-label={hidden ? "Hiện" : "Ẩn"}
            >
              {hidden ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            {!required && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100 hover:text-rose-600"
                aria-label="Xóa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
