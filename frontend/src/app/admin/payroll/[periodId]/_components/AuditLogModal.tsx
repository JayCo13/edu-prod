"use client";

import { useEffect, useMemo, useState } from "react";
import { History, X } from "lucide-react";
import { listPeriodAuditLogsAction } from "@/modules/audit/actions";
import {
  AUDIT_ACTION_LABEL,
  formatTimestampVN,
  renderAuditLine,
} from "@/modules/audit/format";
import type { AuditLogRow } from "@/modules/audit/types";

const INPUT_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

interface Props {
  periodId: string;
  itemIds: string[];
}

/**
 * "Xem lịch sử" — period-scoped audit feed modal.
 *
 * Loads on first open (lazy); subsequent opens reuse the loaded data
 * unless the user refreshes. Filters are client-side (action / user /
 * date range) on top of the fetched batch — cheap for a single
 * center-month's worth of events.
 */
export default function AuditLogModal({ periodId, itemIds }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditLogRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!open || entries !== null) return;
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    listPeriodAuditLogsAction(periodId, itemIds).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.success) setEntries(r.data);
      else setLoadErr(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, entries, periodId, itemIds]);

  const distinctUsers = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, string>();
    for (const e of entries) {
      if (!e.user_id) continue;
      const name = e.metadata.actor_name ?? "(không rõ tên)";
      if (!map.has(e.user_id)) map.set(e.user_id, name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (userFilter !== "all" && e.user_id !== userFilter) return false;
      if (dateFrom && e.created_at < `${dateFrom}T00:00:00`) return false;
      if (dateTo && e.created_at > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [entries, actionFilter, userFilter, dateFrom, dateTo]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <History className="h-4 w-4" />
        Xem lịch sử
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Lịch sử thay đổi
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Mọi thao tác trên kỳ lương đều được lưu lại để đối chiếu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Loại thao tác
                </span>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="all">Tất cả</option>
                  {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Người thực hiện
                </span>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className={INPUT_CLASS}
                  disabled={distinctUsers.length === 0}
                >
                  <option value="all">Tất cả</option>
                  {distinctUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Từ ngày
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Đến ngày
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  Đang tải lịch sử…
                </div>
              ) : loadErr ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {loadErr}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  {entries && entries.length > 0
                    ? "Không có thao tác nào khớp bộ lọc."
                    : "Chưa có thao tác nào được ghi lại."}
                </div>
              ) : (
                <ol className="space-y-3">
                  {filtered.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <p className="text-sm text-slate-800">
                        {renderAuditLine(e)}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
                        <span className="font-mono">{e.action}</span>
                        <span>·</span>
                        <span>{formatTimestampVN(e.created_at)}</span>
                        {e.metadata.ip ? (
                          <>
                            <span>·</span>
                            <span className="font-mono">{e.metadata.ip}</span>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-right text-xs text-slate-500">
              {entries
                ? `${filtered.length} / ${entries.length} thao tác`
                : "—"}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
