"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination — shared list pagination control.
 *
 * Renders "Hiển thị X-Y trên Z" + per-page selector + prev/next page nav.
 * Pairs with the `usePagination` hook below for stateful list paging.
 */

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** When false, hide the per-page selector. */
  showPageSize?: boolean;
  /** Vietnamese unit label shown in the result counter. Default "kết quả". */
  unit?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSize = true,
  unit = "kết quả",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Hide the whole control when the list fits on one page AND there's no
  // page-size selector to expose.
  if (totalPages <= 1 && (!showPageSize || !onPageSizeChange)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">
        Hiển thị{" "}
        <span className="font-mono tabular-nums text-slate-700">
          {start}-{end}
        </span>{" "}
        trên{" "}
        <span className="font-mono tabular-nums text-slate-700">{total}</span>{" "}
        {unit}
      </p>
      <div className="flex items-center gap-2">
        {showPageSize && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            aria-label="Số bản ghi mỗi trang"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {s} / trang
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 font-mono text-xs tabular-nums text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * usePagination — client-side paging over an in-memory array.
 *
 * Use when the full list is already on the client (filtered/sorted in-memory).
 * For server-paged lists, manage `page` / `pageSize` independently and pass
 * them to `<Pagination>` directly.
 *
 * Auto-clamps `page` if `items.length` shrinks below the current page (e.g.
 * when a filter narrows results).
 */
export function usePagination<T>(items: T[], defaultPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  function setPageSize(size: number) {
    setPageSizeRaw(size);
    setPage(1); // jump back to first page when size changes
  }

  return {
    page: safePage,
    pageSize,
    total,
    paged,
    setPage,
    setPageSize,
  };
}
