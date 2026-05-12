"use client";

import { AlertTriangle, Check } from "lucide-react";

export type ToastKind = "saving" | "saved" | "error";

interface ToastProps {
  kind: ToastKind;
  text?: string;
  detail?: string;
}

export function Toast({ kind, text, detail }: ToastProps) {
  const cfg =
    kind === "saved"
      ? {
          icon: <Check className="h-4 w-4" strokeWidth={2.5} />,
          iconBg: "bg-emerald-50 text-emerald-600",
          title: text ?? "Đã lưu nháp",
          sub: detail ?? "Tự động",
        }
      : kind === "saving"
        ? {
            icon: (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
            ),
            iconBg: "bg-amber-50 text-amber-600",
            title: text ?? "Đang lưu thay đổi…",
            sub: detail ?? "Vui lòng đợi…",
          }
        : {
            icon: <AlertTriangle className="h-4 w-4" />,
            iconBg: "bg-rose-50 text-rose-600",
            title: text ?? "Không thể xuất bản",
            sub: detail ?? "Có lỗi cần sửa trước khi xuất bản.",
          };

  return (
    <div className="absolute bottom-20 right-6 z-30 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${cfg.iconBg}`}>
        {cfg.icon}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{cfg.title}</p>
        <p className="mt-0.5 font-mono text-[10.5px] text-slate-500">{cfg.sub}</p>
      </div>
    </div>
  );
}
