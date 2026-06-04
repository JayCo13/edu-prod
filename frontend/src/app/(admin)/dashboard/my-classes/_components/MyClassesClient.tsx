"use client";

import { useEffect, useState } from "react";
import { Calendar, Crown, GraduationCap, Users } from "lucide-react";

import {
  listMyTeacherClasses,
  type MyClassRow,
} from "@/modules/classes/actions";

export default function MyClassesClient() {
  const [rows, setRows] = useState<MyClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyTeacherClasses().then((r) => {
      if (cancelled) return;
      if (r.success) setRows(r.data);
      else setError(r.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
        Đang tải…
      </p>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
        <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          Bạn chưa được gán dạy lớp nào.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Admin trung tâm sẽ gán bạn vào lớp. Khi đó các buổi sẽ tự xuất hiện ở
          đây và trong Lịch dạy.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((c) => (
        <div
          key={c.class_id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900">
                {c.class_name}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.grade_level ? `Khối ${c.grade_level}` : "—"}
                {c.year_label && ` · ${c.year_label}`}
              </p>
            </div>
            <RoleBadge role={c.my_role} />
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Users className="h-3 w-3" />
              {c.active_student_count} HS
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Calendar className="h-3 w-3" />
              {c.total_upcoming_sessions} buổi tới
            </span>
          </div>

          {c.next_session ? (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Buổi tới
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {c.next_session.title}
              </p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-700">
                {formatDateTime(c.next_session.start_time)} ·{" "}
                {c.next_session.duration_minutes} phút
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-500">
              Chưa có buổi học nào sắp tới.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: "PRIMARY" | "ASSISTANT" }) {
  if (role === "PRIMARY") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
        <Crown className="h-3 w-3" />
        GV chính
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
      Trợ giảng
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
