"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Calendar,
  Check,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react";

import { Pagination, usePagination } from "@/components/ui/pagination";
import { useConfirm } from "@/components/ui/confirm-dialog";

import {
  bulkCancelPayments,
  bulkDeletePayments,
  cancelPayment,
  createPayment,
  listPaymentAlerts,
  listStudents,
  markPaymentPaid,
  type PaymentInput,
} from "@/modules/students/actions";
import {
  PAYMENT_STATUS_LABEL,
  type PaymentAlert,
  type StudentRow,
} from "@/modules/students/types";
import { formatVndDigits, parseVndDigits } from "@/lib/format/vnd";

type Tab = "alerts" | "all" | "new";

// Default 30 ngày — phù hợp chu kỳ học phí theo tháng VN (admin tạo
// khoản với hạn ~ ngày trong tháng kế tiếp = ~30 ngày). 7 ngày quá ngắn,
// khoản học phí thường bị lọc ra.
const DEFAULT_WINDOW_DAYS = 30;
const STORAGE_KEY = "edura.payments.windowDays";

export default function PaymentsClient() {
  const [tab, setTab] = useState<Tab>("alerts");
  // Khởi tạo từ localStorage để F5 không reset choice của admin. Đặt
  // sau mount tránh hydration mismatch (server render = default).
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [windowReady, setWindowReady] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) setWindowDays(n);
    } catch {
      /* ignore */
    }
    setWindowReady(true);
  }, []);
  useEffect(() => {
    if (!windowReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(windowDays));
    } catch {
      /* ignore */
    }
  }, [windowDays, windowReady]);
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "upcoming">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [markPay, setMarkPay] = useState<PaymentAlert | null>(null);
  const [reload, setReload] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Đợi localStorage đọc xong mới gọi action — tránh fire 2 lần
    // (lần đầu với default, lần 2 với value đã restore).
    if (!windowReady) return;
    let cancelled = false;
    setLoading(true);
    listPaymentAlerts({ warningWindowDays: windowDays }).then((r) => {
      if (cancelled) return;
      if (r.success) setAlerts(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [windowDays, reload, windowReady]);

  const overdue = useMemo(() => alerts.filter((a) => a.days_until_due < 0), [alerts]);
  const upcoming = useMemo(
    () => alerts.filter((a) => a.days_until_due >= 0),
    [alerts],
  );
  const totalOverdueVnd = overdue.reduce((s, a) => s + a.remaining_vnd, 0);
  const totalUpcomingVnd = upcoming.reduce((s, a) => s + a.remaining_vnd, 0);

  // List class names có trong alerts (cho dropdown filter)
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => {
      if (a.class_name) set.add(a.class_name);
    });
    return [...set].sort();
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let xs = alerts;
    if (statusFilter === "overdue") xs = xs.filter((a) => a.days_until_due < 0);
    else if (statusFilter === "upcoming") xs = xs.filter((a) => a.days_until_due >= 0);
    if (classFilter !== "all") xs = xs.filter((a) => a.class_name === classFilter);
    return xs;
  }, [alerts, statusFilter, classFilter]);

  const {
    page,
    pageSize,
    paged,
    total,
    setPage,
    setPageSize,
  } = usePagination(filteredAlerts, 20);

  const confirm = useConfirm();

  async function handleCancel(p: PaymentAlert) {
    const ok = await confirm({
      title: "Huỷ khoản thu?",
      description: `${p.payment.period_label || "Khoản thu"} của ${p.student.display_name}. Hành động này đặt trạng thái về CANCELLED — vẫn lưu trong lịch sử.`,
      variant: "warning",
      confirmLabel: "Huỷ khoản",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await cancelPayment(p.payment.id);
      if (r.success) {
        setReload((k) => k + 1);
        toast.success("Đã huỷ khoản thu.");
      } else toast.error(r.error);
    });
  }

  // ── Bulk select payments ──────────────────────────────────────────
  function togglePaymentSel(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAllAlerts() {
    setSelected((p) => {
      if (filteredAlerts.every((a) => p.has(a.payment.id))) {
        const n = new Set(p);
        filteredAlerts.forEach((a) => n.delete(a.payment.id));
        return n;
      }
      const n = new Set(p);
      filteredAlerts.forEach((a) => n.add(a.payment.id));
      return n;
    });
  }

  async function handleBulkCancel() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Huỷ ${selected.size} khoản thu?`,
      description:
        "Khoản đã PAID sẽ bị bỏ qua. Khoản huỷ vẫn lưu trong lịch sử với status = CANCELLED.",
      variant: "warning",
      confirmLabel: `Huỷ ${selected.size}`,
    });
    if (!ok) return;
    setBulkPending(true);
    const r = await bulkCancelPayments({ payment_ids: [...selected] });
    setBulkPending(false);
    if (r.success) {
      setSelected(new Set());
      setReload((k) => k + 1);
      const { cancelled, skipped_paid } = r.data;
      const parts: string[] = [`${cancelled} huỷ`];
      if (skipped_paid > 0) parts.push(`${skipped_paid} đã PAID (bỏ qua)`);
      toast.success(`Hoàn tất: ${parts.join(" · ")}`);
    } else toast.error(r.error);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Xoá ${selected.size} khoản thu?`,
      description:
        "XOÁ CỨNG — không thể hoàn tác. Khoản đã PAID sẽ bị bỏ qua. Chỉ dùng khi tạo nhầm hàng loạt.",
      variant: "danger",
      confirmLabel: `Xoá ${selected.size}`,
    });
    if (!ok) return;
    setBulkPending(true);
    const r = await bulkDeletePayments({ payment_ids: [...selected] });
    setBulkPending(false);
    if (r.success) {
      setSelected(new Set());
      setReload((k) => k + 1);
      const { deleted, skipped_paid } = r.data;
      const parts: string[] = [`${deleted} xoá`];
      if (skipped_paid > 0) parts.push(`${skipped_paid} đã PAID (bỏ qua)`);
      toast.success(`Hoàn tất: ${parts.join(" · ")}`);
    } else toast.error(r.error);
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Tab active={tab === "alerts"} onClick={() => setTab("alerts")}>
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
          Cảnh báo ({overdue.length}+{upcoming.length})
        </Tab>
        <Tab active={tab === "new"} onClick={() => setTab("new")}>
          <Plus className="mr-1 inline h-3.5 w-3.5" />
          Tạo khoản thu
        </Tab>
      </div>

      {tab === "alerts" && (
        <>
          {/* Stats */}
          <div className="grid gap-2 sm:grid-cols-2">
            <StatCard
              tone="rose"
              label="Quá hạn"
              count={overdue.length}
              total={totalOverdueVnd}
            />
            <StatCard
              tone="amber"
              label={`Sắp tới hạn (≤ ${windowDays} ngày)`}
              count={upcoming.length}
              total={totalUpcomingVnd}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Hạn trong</span>
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
            >
              <option value={3}>3 ngày tới</option>
              <option value={7}>7 ngày tới</option>
              <option value={14}>14 ngày tới</option>
              <option value={30}>30 ngày tới</option>
              <option value={60}>60 ngày tới</option>
              <option value={365}>Tất cả khoản chưa đóng</option>
            </select>

            <span className="ml-1 font-semibold text-slate-500">Trạng thái:</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
              {(
                [
                  ["all", "Tất cả"],
                  ["overdue", "Quá hạn"],
                  ["upcoming", "Sắp tới"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatusFilter(v)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    statusFilter === v
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {classOptions.length > 0 && (
              <>
                <span className="ml-1 font-semibold text-slate-500">Lớp:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
                >
                  <option value="all">Tất cả</option>
                  {classOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </>
            )}

            {(statusFilter !== "all" || classFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setClassFilter("all");
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Xoá bộ lọc
              </button>
            )}
            <span className="ml-auto text-slate-400">F5 giữ lựa chọn</span>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
              Đang tải…
            </p>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-12 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Không có khoản thu nào quá hạn hoặc sắp tới hạn.
              </p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                Không khoản nào khớp bộ lọc hiện tại.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Đổi trạng thái hoặc bỏ filter lớp để xem khoản khác.
              </p>
            </div>
          ) : (
            <>
              {selected.size > 0 && (
                <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 shadow-sm backdrop-blur">
                  <p className="text-sm font-semibold text-indigo-900">
                    Đã chọn <span className="font-mono">{selected.size}</span> /{" "}
                    {filteredAlerts.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Bỏ chọn
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkCancel}
                      disabled={bulkPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" />
                      Huỷ {selected.size}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={bulkPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Xoá {selected.size}
                    </button>
                  </div>
                </div>
              )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredAlerts.length > 0 &&
                          filteredAlerts.every((a) => selected.has(a.payment.id))
                        }
                        ref={(el) => {
                          if (!el) return;
                          const some = filteredAlerts.some((a) => selected.has(a.payment.id));
                          const all = filteredAlerts.every((a) => selected.has(a.payment.id));
                          el.indeterminate = some && !all;
                        }}
                        onChange={toggleAllAlerts}
                        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left">Học sinh</th>
                    <th className="px-3 py-2.5 text-left">Lớp</th>
                    <th className="px-3 py-2.5 text-left">Kỳ</th>
                    <th className="px-3 py-2.5 text-right">Số tiền còn</th>
                    <th className="px-3 py-2.5 text-left">Hạn</th>
                    <th className="px-3 py-2.5 text-left">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map((a) => {
                    const isSel = selected.has(a.payment.id);
                    return (
                    <tr
                      key={a.payment.id}
                      className={`${
                        a.days_until_due < 0
                          ? "bg-rose-50/30"
                          : a.days_until_due <= 3
                            ? "bg-amber-50/30"
                            : ""
                      } ${isSel ? "ring-1 ring-indigo-200" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => togglePaymentSel(a.payment.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900">
                          {a.student.display_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {a.student.student_code}
                          {a.student.parent_phone && ` · ${a.student.parent_phone}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {a.class_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {a.payment.period_label || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">
                        {formatVnd(a.remaining_vnd)}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        <div className="text-slate-700">{formatDate(a.payment.due_date)}</div>
                        <div
                          className={`text-xs ${
                            a.days_until_due < 0
                              ? "font-bold text-rose-700"
                              : a.days_until_due <= 3
                                ? "font-semibold text-amber-700"
                                : "text-slate-500"
                          }`}
                        >
                          {a.days_until_due < 0
                            ? `Quá hạn ${Math.abs(a.days_until_due)} ngày`
                            : a.days_until_due === 0
                              ? "Hôm nay"
                              : `Còn ${a.days_until_due} ngày`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={a.payment.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setMarkPay(a)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                            Đã thu
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(a)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                            title="Huỷ khoản thu"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              unit="khoản"
            />
            </>
          )}
        </>
      )}

      {tab === "new" && (
        <NewPaymentForm
          onViewInAlerts={(daysAhead) => {
            // Snap về 1 trong các option chuẩn để select hiển thị đúng.
            const standardOptions = [3, 7, 14, 30, 60, 365];
            const need = standardOptions.find((n) => n >= daysAhead) ?? 365;
            setWindowDays(need);
            setTab("alerts");
            setReload((k) => k + 1);
          }}
          onAnyChange={() => setReload((k) => k + 1)}
        />
      )}

      {markPay && (
        <MarkPaidModal
          alert={markPay}
          onClose={() => setMarkPay(null)}
          onDone={() => {
            setMarkPay(null);
            setReload((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  tone,
  label,
  count,
  total,
}: {
  tone: "rose" | "amber";
  label: string;
  count: number;
  total: number;
}) {
  const colors =
    tone === "rose"
      ? "border-rose-200 bg-rose-50/40 text-rose-800"
      : "border-amber-200 bg-amber-50/40 text-amber-800";
  return (
    <div className={`rounded-2xl border p-3 ${colors}`}>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{count}</p>
      <p className="mt-0.5 font-mono text-xs tabular-nums opacity-80">
        Tổng: {formatVnd(total)}
      </p>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-600",
    PARTIAL: "bg-amber-100 text-amber-700",
    OVERDUE: "bg-rose-100 text-rose-700",
    PAID: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-slate-200 text-slate-500 line-through",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {PAYMENT_STATUS_LABEL[status as keyof typeof PAYMENT_STATUS_LABEL] ?? status}
    </span>
  );
}

function NewPaymentForm({
  onViewInAlerts,
  onAnyChange,
}: {
  onViewInAlerts: (daysAheadOfToday: number) => void;
  onAnyChange: () => void;
}) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(5);
    return d.toISOString().slice(0, 10);
  });
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastCreated, setLastCreated] = useState<{
    studentName: string;
    amountVnd: number;
    dueDate: string;
    daysAhead: number;
  } | null>(null);

  useEffect(() => {
    listStudents().then((r) => {
      if (r.success) setStudents(r.data);
    });
  }, []);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 50);
    const q = studentSearch.toLowerCase();
    return students
      .filter(
        (s) =>
          s.display_name.toLowerCase().includes(q) ||
          s.student_code.toLowerCase().includes(q) ||
          (s.parent_phone ?? "").includes(q),
      )
      .slice(0, 50);
  }, [students, studentSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId) {
      setError("Chọn học sinh.");
      return;
    }
    const amountVnd = parseVndDigits(amount);
    if (!amountVnd) {
      setError("Số tiền phải lớn hơn 0.");
      return;
    }
    const input: PaymentInput = {
      student_id: studentId,
      amount_vnd: amountVnd,
      due_date: dueDate,
      period_label: period.trim(),
      note: note.trim() || null,
    };
    const studentName =
      students.find((s) => s.id === studentId)?.display_name ?? "Học sinh";
    startTransition(async () => {
      const r = await createPayment(input);
      if (r.success) {
        // Tính số ngày từ today → due_date để hiển thị + để parent
        // expand window khi user bấm "Xem trong cảnh báo".
        const today = new Date();
        const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const t1 = new Date(dueDate + "T00:00:00");
        const daysAhead = Math.round((t1.getTime() - t0.getTime()) / 86400000);

        setLastCreated({ studentName, amountVnd, dueDate, daysAhead });
        // Reset form về trạng thái sẵn sàng tạo tiếp khoản mới
        setStudentId("");
        setStudentSearch("");
        setAmount("");
        setPeriod("");
        setNote("");
        setError(null);
        // Báo parent reload (dashboard banner, alerts đếm…)
        onAnyChange();
      } else setError(r.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-bold text-slate-900">
        <Receipt className="mr-1 inline h-4 w-4" />
        Tạo khoản thu mới
      </h3>

      {lastCreated && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Đã tạo khoản thu</p>
            <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">
              <strong>{lastCreated.studentName}</strong> ·{" "}
              <span className="font-mono">{formatVnd(lastCreated.amountVnd)}</span> · hạn{" "}
              <span className="font-mono">{formatDate(lastCreated.dueDate)}</span>{" "}
              {lastCreated.daysAhead < 0
                ? `(quá hạn ${Math.abs(lastCreated.daysAhead)} ngày)`
                : lastCreated.daysAhead === 0
                  ? "(hôm nay)"
                  : `(còn ${lastCreated.daysAhead} ngày)`}
            </p>
            {lastCreated.daysAhead > 7 && (
              <p className="mt-1 text-xs text-emerald-700">
                Khoản này còn xa hơn cửa sổ cảnh báo mặc định (7 ngày) nên
                chưa hiện trong tab Cảnh báo.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onViewInAlerts(lastCreated.daysAhead)}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                Xem trong cảnh báo →
              </button>
              <button
                type="button"
                onClick={() => setLastCreated(null)}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Tạo khoản khác
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label>Học sinh *</Label>
        <input
          type="search"
          placeholder="Tìm theo tên / mã / SĐT phụ huynh"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          className={inputCls}
        />
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
          size={Math.min(5, filteredStudents.length || 1) + 1}
          className={`${inputCls} mt-1 h-auto`}
        >
          <option value="">— Chọn từ danh sách —</option>
          {filteredStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.student_code} · {s.display_name}
              {s.parent_phone ? ` · ${s.parent_phone}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Số tiền *</Label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(formatVndDigits(e.target.value))}
              placeholder="1.500.000"
              className={`${inputCls} pr-8 font-mono tabular-nums`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
              đ
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <Label>
            <Calendar className="mr-1 inline h-3 w-3" />
            Hạn đóng *
          </Label>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Kỳ học phí</Label>
        <input
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="vd. Tháng 6/2026, Khoá Hè 2026"
          className={inputCls}
        />
      </div>

      <div className="space-y-1">
        <Label>Ghi chú</Label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Đang tạo…" : "Tạo khoản thu"}
      </button>
    </form>
  );
}

function MarkPaidModal({
  alert,
  onClose,
  onDone,
}: {
  alert: PaymentAlert;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(formatVndDigits(alert.remaining_vnd.toString()));
  const [method, setMethod] = useState("CASH");
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountVnd = parseVndDigits(amount);
    if (!amountVnd || amountVnd <= 0) {
      setError("Số tiền phải lớn hơn 0.");
      return;
    }
    if (amountVnd > alert.remaining_vnd) {
      setError(`Số tiền không vượt quá ${formatVnd(alert.remaining_vnd)} còn nợ.`);
      return;
    }
    startTransition(async () => {
      const r = await markPaymentPaid({
        payment_id: alert.payment.id,
        amount_vnd: amountVnd,
        paid_date: date,
        method,
        receipt_no: receipt.trim() || undefined,
      });
      if (r.success) onDone();
      else setError(r.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Đánh dấu đã thu</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-mono">{alert.student.student_code}</span> ·{" "}
          {alert.student.display_name}
          {alert.payment.period_label && ` · ${alert.payment.period_label}`}
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
          Còn nợ: <strong className="font-mono">{formatVnd(alert.remaining_vnd)}</strong>{" "}
          / {formatVnd(alert.payment.amount_vnd)}
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label>Số tiền thu</Label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                value={amount}
                onChange={(e) => setAmount(formatVndDigits(e.target.value))}
                className={`${inputCls} pr-8 font-mono tabular-nums`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                đ
              </span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Hình thức</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
                <option value="MOMO">MoMo</option>
                <option value="ZALOPAY">ZaloPay</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ngày thu</Label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Số biên lai (tuỳ chọn)</Label>
            <input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              className={inputCls}
              placeholder="vd. BL-2026-0142"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang ghi…" : "Ghi nhận đã thu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
