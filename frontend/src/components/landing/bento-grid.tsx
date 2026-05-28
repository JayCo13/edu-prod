import {
  Calendar,
  FileSpreadsheet,
  LayoutDashboard,
  LayoutGrid,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { ACCENT } from "./_accent";

/**
 * Bento — 5 feature cards in an asymmetric grid (payroll spans 2×2,
 * dashboard spans the bottom 2 cols on the right to fill the row).
 *
 * The big payroll card includes a mini Excel-style preview because the
 * BẢNG LƯƠNG export is the killer thing center owners pay for; everything
 * else is a sentence + a small visual.
 */
export default function BentoGrid() {
  const A = ACCENT;
  return (
    <section id="features" className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p
              className="font-mono text-[13px] font-bold uppercase tracking-[0.18em]"
              style={{ color: A.solid }}
            >
              · TÍNH NĂNG
            </p>
            <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
              Năm việc bạn làm hàng tuần,
              <br />
              <span className="text-slate-400">gom vào một chỗ.</span>
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-slate-600">
            Không LMS rối, không feature thừa. Chỉ tập trung vào lịch, lương,
            và giáo viên.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <PayrollCard A={A} />
          <TimetableCard A={A} />
          <MultiTeacherCard />
          <TeacherMgmtCard />
          <DashboardCard A={A} />
        </div>
      </div>
    </section>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────

function Card({
  span = "",
  children,
}: {
  span?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-[0_18px_40px_-12px_rgb(15_23_42/0.08)] ${span}`}
    >
      {children}
    </div>
  );
}

function CardTitle({
  icon,
  color,
  bg,
  children,
}: {
  icon: ReactNode;
  color: string;
  bg: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: bg, color }}
      >
        {icon}
      </span>
      <h3 className="font-display text-[15.5px] font-semibold text-slate-900">
        {children}
      </h3>
    </div>
  );
}

function StatPill({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
      {children}
    </span>
  );
}

// ── 1. Payroll — large (2×2) ───────────────────────────────────────────

function PayrollCard({ A }: { A: typeof ACCENT }) {
  return (
    <Card span="sm:col-span-2 sm:row-span-2">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl text-emerald-600"
          style={{ background: "rgb(16 185 129 / 0.1)" }}
        >
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <h3 className="font-display text-[15.5px] font-semibold text-slate-900">
          Bảng lương tự động
        </h3>
        <StatPill>Xuất Excel</StatPill>
      </div>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-600">
        Theo giờ, theo buổi, lương cứng, hoặc kết hợp — hệ thống tính dựa trên
        lịch dạy thật. Có nút Xuất Excel BẢNG LƯƠNG để in ra cho kế toán hoặc
        đối chiếu khi chuyển khoản.
      </p>

      <div className="mt-6 grow">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span
              className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white"
              style={{ background: "#107c41" }}
            >
              X
            </span>
            <p className="font-mono text-[10.5px] text-slate-700">
              BẢNG_LƯƠNG_T4_2026.xlsx
            </p>
            <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-700">
              Đã chốt
            </span>
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-2.5 py-1.5 text-left">
                  Giáo viên
                </th>
                <th className="border-b border-slate-200 px-2.5 py-1.5 text-right">
                  Giờ
                </th>
                <th className="border-b border-slate-200 px-2.5 py-1.5 text-right">
                  Đơn giá
                </th>
                <th className="border-b border-slate-200 px-2.5 py-1.5 text-right">
                  Thưởng
                </th>
                <th className="border-b border-slate-200 px-2.5 py-1.5 text-right">
                  Lương
                </th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-slate-700">
              {(
                [
                  ["Cô Linh L.", "84", "250.000", "1.000.000", "22.000.000"],
                  ["Thầy Hùng N.", "62", "300.000", "—", "18.600.000"],
                  ["Cô Mai T.", "48", "220.000", "500.000", "11.060.000"],
                  ["Thầy Đức P.", "—", "5.000.000", "—", "5.000.000"],
                  ["Cô Hoa V.", "72", "200.000", "—", "14.400.000"],
                ] as const
              ).map((r, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                >
                  <td className="px-2.5 py-1.5 font-sans font-medium text-slate-900">
                    {r[0]}
                  </td>
                  <td className="px-2.5 py-1.5 text-right">{r[1]}</td>
                  <td className="px-2.5 py-1.5 text-right">{r[2]}</td>
                  <td className="px-2.5 py-1.5 text-right text-slate-400">
                    {r[3]}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-semibold text-slate-900">
                    {r[4]}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-2.5 py-1.5 font-sans font-bold text-slate-900">
                  Tổng · 18 GV
                </td>
                <td className="px-2.5 py-1.5" />
                <td className="px-2.5 py-1.5" />
                <td className="px-2.5 py-1.5" />
                <td className="px-2.5 py-1.5 text-right font-display font-bold text-slate-900">
                  184.250.000
                  <span className="ml-0.5 font-display text-[10px] font-semibold text-slate-500">
                    ₫
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "Theo giờ",
            "Theo buổi",
            "Lương cứng",
            "Thưởng / Khấu trừ",
            "Đối chiếu ngân hàng",
          ].map((t) => (
            <span
              key={t}
              className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10.5px] font-medium text-slate-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      {/* preserve A reference so theme is consistent across cards */}
      <span hidden style={{ background: A.tint }} />
    </Card>
  );
}

// ── 2. Timetable (with mini Ngày × Tiết grid) ──────────────────────────

function TimetableCard({ A }: { A: typeof ACCENT }) {
  const rows: ({ c: string } | null)[][] = [
    [{ c: A.solid }, null, { c: "#10b981" }, null, { c: A.solid }, null],
    [null, { c: "#f59e0b" }, null, { c: "#10b981" }, null, { c: "#f59e0b" }],
    [
      { c: "#10b981" },
      null,
      { c: A.solid },
      null,
      { c: "#10b981" },
      { c: A.solid },
    ],
    [
      null,
      { c: A.solid },
      { c: "#f59e0b" },
      null,
      null,
      { c: "#10b981" },
    ],
  ];
  return (
    <Card>
      <div className="flex items-center gap-3">
        <CardTitle
          icon={<LayoutGrid className="h-4 w-4" />}
          color="#0284c7"
          bg="#e0f2fe"
        >
          Thời khoá biểu
        </CardTitle>
        <StatPill>Phát hiện trùng giờ</StatPill>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
        Grid Ngày × Tiết × Giáo viên. In được, và cảnh báo nếu xếp một giáo
        viên vào hai lớp cùng tiết.
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        <div className="grid grid-cols-7 bg-slate-50 font-mono text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {["Tiết", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
            <div
              key={i}
              className={`px-1.5 py-1.5 text-center ${
                i > 0 ? "border-l border-slate-200" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-7 border-t border-slate-100">
            <div className="px-1.5 py-2 text-center font-mono text-[9.5px] tabular-nums text-slate-500">
              {r + 1}
            </div>
            {row.map((cell, c) => (
              <div key={c} className="border-l border-slate-100 p-1">
                {cell ? (
                  <span
                    className="block h-3 rounded-sm"
                    style={{ background: cell.c }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 3. Multi-teacher calendar (load bars) ──────────────────────────────

function MultiTeacherCard() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <CardTitle
          icon={<Calendar className="h-4 w-4" />}
          color="#7c3aed"
          bg="#ede9fe"
        >
          Lịch dạy đa GV
        </CardTitle>
        <StatPill>Đa giáo viên</StatPill>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
        Xem lịch tất cả giáo viên trên một màn. Lens &ldquo;Của tôi&rdquo; để
        từng giáo viên lọc chỉ buổi của họ.
      </p>
      <div className="mt-4 space-y-1.5">
        {[
          { n: "Cô Linh L.", c: "#4f46e5", load: 92, hrs: "84h" },
          { n: "Thầy Hùng N.", c: "#10b981", load: 68, hrs: "62h" },
          { n: "Cô Mai T.", c: "#f59e0b", load: 53, hrs: "48h" },
          { n: "Cô Hoa V.", c: "#e11d48", load: 78, hrs: "72h" },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold text-white"
              style={{ background: t.c }}
            >
              {t.n.split(" ").slice(-1)[0][0]}
            </span>
            <span className="w-20 truncate text-[10.5px] font-medium text-slate-700">
              {t.n}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${t.load}%`, background: t.c }}
              />
            </div>
            <span className="w-7 text-right font-mono text-[9.5px] tabular-nums text-slate-500">
              {t.hrs}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 4. Teacher management ──────────────────────────────────────────────

function TeacherMgmtCard() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <CardTitle
          icon={<Users className="h-4 w-4" />}
          color="#d97706"
          bg="#fef3c7"
        >
          Quản lý giáo viên
        </CardTitle>
        <StatPill>Mời qua email</StatPill>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
        Mời giáo viên qua email, set đơn giá lương riêng từng người, phân vai
        trò admin hoặc teacher.
      </p>
      <div className="mt-4 space-y-1.5">
        {[
          {
            n: "Cô Linh L.",
            r: "Teacher",
            price: "₫250k / giờ",
            color: "#4f46e5",
            pending: false,
          },
          {
            n: "Thầy Hùng N.",
            r: "Admin",
            price: "₫300k / giờ",
            color: "#10b981",
            pending: false,
          },
          {
            n: "Cô Hoa V.",
            r: "Đang mời",
            price: "Chờ xác nhận",
            color: "#94a3b8",
            pending: true,
          },
        ].map((t, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold text-white"
                style={{ background: t.color }}
              >
                {t.n.split(" ").slice(-1)[0][0]}
              </span>
              <span className="truncate text-[10.5px] font-medium text-slate-900">
                {t.n}
              </span>
              <span
                className={`rounded px-1 py-0.5 font-mono text-[9px] font-semibold ${
                  t.pending
                    ? "bg-amber-50 text-amber-700"
                    : t.r === "Admin"
                      ? "bg-violet-50 text-violet-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {t.r}
              </span>
            </div>
            <span className="font-mono text-[9.5px] text-slate-500">
              {t.price}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 5. Dashboard ───────────────────────────────────────────────────────

function DashboardCard({ A }: { A: typeof ACCENT }) {
  // Match the live admin dashboard's top-row stat cards (uppercase label, big
  // tabular number, trend caption with arrow). The bento version sits inside a
  // 2-col card, so we use the same 3 KPIs as the hero preview and add a
  // compact "today's timeline" strip to hint at the page below.
  const stats = [
    { l: "Buổi hôm nay", v: "14", d: "9 đang dạy", c: A.solid },
    { l: "GV active", v: "18 / 20", d: "+2 tháng này", c: "#10b981" },
    {
      l: "Lương tháng 4",
      v: "184M",
      suffix: "₫",
      d: "Đã trả 100%",
      c: "#f59e0b",
    },
  ] as const;
  return (
    <Card span="sm:col-span-2">
      <div className="flex items-center gap-3">
        <CardTitle
          icon={<LayoutDashboard className="h-4 w-4" />}
          color={A.solid}
          bg={A.tint}
        >
          Bảng điều khiển
        </CardTitle>
        <StatPill>Mọi thứ một màn</StatPill>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
        Buổi hôm nay, việc tồn đọng, lương tháng, hoạt động gần đây — gọn
        ngay khi mở trang chủ.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((k, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-100 bg-white p-3"
          >
            <p className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-slate-400">
              {k.l}
            </p>
            <p className="mt-1 font-display text-[20px] font-bold tabular-nums text-slate-900">
              {k.v}
              {"suffix" in k && k.suffix && (
                <span className="ml-0.5 font-display text-[13px] font-semibold text-slate-500">
                  {k.suffix}
                </span>
              )}
            </p>
            <p
              className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold"
              style={{ color: k.c }}
            >
              <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
              {k.d}
            </p>
          </div>
        ))}
      </div>
      {/* Mini timeline strip — same idea as the hero's "Buổi học hôm nay"
          panel, in a single row to fit the card height. */}
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Buổi học hôm nay
          </p>
          <span className="font-mono text-[9.5px] text-slate-400">
            07:00 — 21:00
          </span>
        </div>
        <div className="mt-2 space-y-1">
          {(
            [
              { t: "08:00", w: 22, ml: 4, c: A.solid },
              { t: "10:00", w: 32, ml: 26, c: "#e11d48" },
              { t: "15:00", w: 28, ml: 56, c: A.solid },
              { t: "19:00", w: 18, ml: 70, c: A.solid },
            ] as const
          ).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-9 font-mono text-[9.5px] tabular-nums text-slate-400">
                {b.t}
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${b.w}%`,
                    marginLeft: `${b.ml}%`,
                    background: b.c,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

