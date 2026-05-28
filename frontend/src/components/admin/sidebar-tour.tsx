"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

// ── Tour theo trang ─────────────────────────────────────────────────────────
//
// Triết lý: tour không tự điều hướng giữa các trang. Khi quản trị viên vào
// một trang lần đầu, chỉ tour của trang đó chạy, lướt qua các phần quan
// trọng trên trang. Khi đóng tour (hoặc bấm Hoàn tất), trang đó sẽ không
// mở tour lại — phiên bản tăng (v2, v3…) chỉ cần đổi `storageKey` là
// hiện lại với người dùng cũ.
//
// Mọi bước trong cùng một tour đều nằm trên cùng một trang nên không cần
// router.push(), không cần prefetch. Bước nào không tìm thấy phần tử
// (vd. tài khoản SCHOOL không có "Tổng quan tài chính") sẽ bị bỏ qua
// trước khi tour bắt đầu.

interface TourStep {
  selector: string;
  title: string;
  description: string;
}

interface RouteTour {
  /** Tour chạy khi pathname === prefix HOẶC pathname bắt đầu bằng prefix + "/". */
  prefix: string;
  /** Khóa lưu trong localStorage để nhớ "đã xem". Đổi version → hiện lại. */
  storageKey: string;
  steps: TourStep[];
}

// Sắp xếp theo độ chi tiết của prefix — `pickTour` chọn cái khớp dài nhất.
const ROUTE_TOURS: RouteTour[] = [
  // ── Bảng lương (chỉ trung tâm) ──────────────────────────────────────────
  {
    prefix: "/admin/payroll",
    storageKey: "tour:payroll:v1",
    steps: [
      {
        selector: '[data-tour="payroll.new-period"]',
        title: "Tạo kỳ lương mới",
        description:
          "Mỗi cuối tháng, bấm vào đây để tạo kỳ lương. Hệ thống tự tổng hợp các buổi đã hoàn thành của tất cả giáo viên và tính ra số tiền dựa trên mức lương đã cấu hình.",
      },
      {
        selector: '[data-tour="payroll.periods-list"]',
        title: "Danh sách các kỳ lương",
        description:
          "Các kỳ đã tạo hiển thị ở đây, kèm trạng thái: nháp (đang chỉnh), đã duyệt, hoặc đã thanh toán. Bấm vào một dòng để xem chi tiết từng giáo viên.",
      },
    ],
  },

  // ── Cài đặt ─────────────────────────────────────────────────────────────
  {
    prefix: "/admin/settings",
    storageKey: "tour:settings:v1",
    steps: [
      {
        selector: "main",
        title: "Cài đặt trung tâm",
        description:
          "Tên trung tâm, logo, ngày chốt lương và các thông số mặc định khác — đặt một lần để dùng cho cả hệ thống.",
      },
    ],
  },

  // ── Thời khoá biểu — trình soạn ─────────────────────────────────────────
  {
    prefix: "/dashboard/timetable/editor",
    storageKey: "tour:timetable.editor:v1",
    steps: [
      {
        selector: "main",
        title: "Trang xếp thời khoá biểu",
        description:
          "Đây là bảng Thứ × Tiết của cả khối. Bấm vào ô trống để gán môn và giáo viên. Có chế độ quét nhanh và chọn nhiều ô cùng lúc để xếp nhanh hơn.",
      },
    ],
  },

  // ── Thời khoá biểu — trang gốc ──────────────────────────────────────────
  {
    prefix: "/dashboard/timetable",
    storageKey: "tour:timetable:v1",
    steps: [
      {
        selector: '[data-tour="tkb.tabs"]',
        title: "Quy trình xếp thời khoá biểu",
        description:
          "Đi theo thứ tự: khai báo Lớp → Môn → Khung tiết → vào Trang xếp lịch để gán môn vào từng ô.",
      },
      {
        selector: '[data-tour="tkb.editor-link"]',
        title: "Trang xếp lịch",
        description:
          "Bấm vào đây để mở bảng Thứ × Tiết — nơi bạn xếp môn vào từng ô cho cả khối, sau đó in hoặc chia sẻ mã QR cho học sinh.",
      },
    ],
  },

  // ── Giáo viên ──────────────────────────────────────────────────────────
  {
    prefix: "/dashboard/teachers",
    storageKey: "tour:teachers:v1",
    steps: [
      {
        selector: '[data-tour="teachers.add"]',
        title: "Thêm giáo viên mới",
        description:
          "Nhập email và mật khẩu tạm — giáo viên đổi mật khẩu trong vòng 24 giờ là vào được tài khoản. Sau đó bạn đặt mức lương cho từng người.",
      },
      {
        selector: '[data-tour="teachers.filters"]',
        title: "Lọc và tìm kiếm",
        description:
          "Gõ tên (không cần dấu cũng tìm được) hoặc lọc theo trạng thái / vai trò để nhanh chóng tìm đúng giáo viên cần xem.",
      },
    ],
  },

  // ── Lịch dạy ───────────────────────────────────────────────────────────
  {
    prefix: "/dashboard/calendar",
    storageKey: "tour:calendar:v1",
    steps: [
      {
        selector: "main",
        title: "Lịch dạy của trung tâm",
        description:
          "Xem lịch theo tuần hoặc tháng. Bấm vào ô trống để tạo buổi mới — hệ thống tự cảnh báo khi giáo viên hoặc phòng trùng giờ với buổi khác.",
      },
    ],
  },

  // ── Nhận lương (giáo viên dùng) ────────────────────────────────────────
  {
    prefix: "/dashboard/payouts",
    storageKey: "tour:payouts:v1",
    steps: [
      {
        selector: "main",
        title: "Thông tin nhận lương",
        description:
          "Khai báo cách bạn muốn nhận lương: chuyển khoản ngân hàng (kèm số tài khoản) hoặc nhận tiền mặt. Quản trị viên sẽ thấy thông tin này khi chi lương.",
      },
    ],
  },

  // ── Khóa học ───────────────────────────────────────────────────────────
  {
    prefix: "/dashboard/courses",
    storageKey: "tour:courses:v1",
    steps: [
      {
        selector: "main",
        title: "Danh mục khóa học",
        description:
          "Khai báo các khóa học của trung tâm — đặt tên, mô tả, số buổi, giáo viên phụ trách. Dùng làm khuôn để tạo buổi dạy ở mục Lịch dạy.",
      },
    ],
  },

  // ── Trang chủ ──────────────────────────────────────────────────────────
  //
  // Để cuối cùng vì prefix "/dashboard" trùng với rất nhiều route con —
  // pickTour() chọn match dài nhất nên các route con kể trên sẽ ưu tiên
  // tour của mình thay vì rơi vào tour Trang chủ này.
  {
    prefix: "/dashboard",
    storageKey: "tour:dashboard:v1",
    steps: [
      // CENTER
      {
        selector: '[data-tour="dashboard.today"]',
        title: "Buổi học hôm nay",
        description:
          "Danh sách các buổi diễn ra trong ngày — giáo viên, giờ bắt đầu, trạng thái. Buổi bị huỷ được gạch ngang để dễ phân biệt.",
      },
      {
        selector: '[data-tour="dashboard.todo"]',
        title: "Việc cần làm",
        description:
          "Các việc còn tồn đọng: giáo viên chưa cấu hình lương, kỳ lương chưa duyệt, kỳ lương đã duyệt nhưng chưa chi. Bấm vào dòng tương ứng để đi thẳng tới trang cần xử lý.",
      },
      {
        selector: '[data-tour="dashboard.finance"]',
        title: "Tổng quan tài chính",
        description:
          "Tổng lương dự kiến của tháng, số tiền đã chi, số buổi đã / đang dạy và số giáo viên hoạt động. Cập nhật tự động khi có thay đổi.",
      },
      // SCHOOL — các bước này dùng cùng selector với CENTER nhưng widget
      // có nội dung khác. Nếu cả CENTER và SCHOOL cùng có selector
      // "dashboard.today" thì bước này sẽ không cần hiện riêng. Đặt thêm
      // bước cho widget chỉ-có-ở-SCHOOL.
      {
        selector: '[data-tour="dashboard.grade-breakdown"]',
        title: "Thời khoá biểu theo khối",
        description:
          "Tóm tắt tình trạng xếp lịch của từng khối (lớp, số tiết đã xếp, % có giáo viên chủ nhiệm). Bấm vào một khối để vào thẳng trang xếp lịch của khối đó.",
      },
    ],
  },
];

const HIGHLIGHT_PADDING = 6;
const WAIT_TIMEOUT_MS = 1500;
const FAST = { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const };

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function pickTour(pathname: string): RouteTour | null {
  let best: RouteTour | null = null;
  for (const t of ROUTE_TOURS) {
    if (pathname === t.prefix || pathname.startsWith(t.prefix + "/")) {
      if (!best || t.prefix.length > best.prefix.length) best = t;
    }
  }
  return best;
}

function measureRect(el: HTMLElement): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    top: r.top - HIGHLIGHT_PADDING,
    left: r.left - HIGHLIGHT_PADDING,
    width: r.width + HIGHLIGHT_PADDING * 2,
    height: r.height + HIGHLIGHT_PADDING * 2,
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export function SidebarTour() {
  const pathname = usePathname();

  // Tour áp dụng cho pathname hiện tại (longest-prefix match).
  const tour = useMemo(() => pickTour(pathname || ""), [pathname]);

  // Pha hoạt động:
  //   idle    — chưa quyết định (đang load localStorage / chờ DOM)
  //   running — đang chạy tour
  //   done    — đã đóng (đã xem xong hoặc bỏ qua / không có tour cho trang)
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  // Reset khi đổi trang → kiểm tra lại tour cho route mới.
  useEffect(() => {
    setPhase("idle");
    setStepIndex(0);
    setRect(null);
  }, [pathname]);

  // Lọc bước theo selector có tồn tại trên trang hay không. Tránh trường
  // hợp CENTER không có "dashboard.finance" — sẽ tự bỏ bước đó.
  // Đo trong một useLayoutEffect riêng để đợi DOM render xong.
  const [availableSteps, setAvailableSteps] = useState<TourStep[] | null>(null);
  useLayoutEffect(() => {
    if (!tour) {
      setAvailableSteps([]);
      return;
    }
    // Đợi ~250ms cho trang render thêm nội dung (vd. cards có animate-in)
    // rồi mới quét. Tránh quét quá sớm — selector trên trang còn đang
    // chờ skeleton.
    const t = window.setTimeout(() => {
      const present: TourStep[] = [];
      for (const s of tour.steps) {
        const el = document.querySelector<HTMLElement>(s.selector);
        if (el && el.getBoundingClientRect().width > 0) present.push(s);
      }
      setAvailableSteps(present);
    }, 250);
    return () => clearTimeout(t);
  }, [tour, pathname]);

  // Quyết định bật / không bật khi đã có danh sách bước thực tế.
  useEffect(() => {
    if (availableSteps === null) return;
    if (!tour || availableSteps.length === 0) {
      setPhase("done");
      return;
    }
    try {
      if (localStorage.getItem(tour.storageKey) === "1") {
        setPhase("done");
        return;
      }
    } catch {
      /* localStorage không dùng được — vẫn chạy */
    }
    setPhase("running");
  }, [availableSteps, tour]);

  // Theo dõi viewport — debounce qua rAF.
  useEffect(() => {
    function read() {
      setVp({ w: window.innerWidth, h: window.innerHeight });
    }
    read();
    let raf = 0;
    function onResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Mobile bỏ qua — quá hẹp để spotlight bên cạnh, dễ rối.
  useEffect(() => {
    if (phase === "running" && vp.w > 0 && vp.w < 1024) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, vp.w]);

  // Đo phần tử của bước hiện tại. Tất cả selector đều cùng route nên
  // không cần navigate — chỉ cần đợi nếu phần tử đang re-render.
  useLayoutEffect(() => {
    if (phase !== "running" || !availableSteps) return;
    const step = availableSteps[stepIndex];
    if (!step) return;

    const direct = document.querySelector<HTMLElement>(step.selector);
    if (direct) {
      const r = measureRect(direct);
      if (r) {
        setRect(r);
        direct.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Hiếm khi cần — chờ phần tử qua MutationObserver làm fallback.
    let resolved = false;
    const obs = new MutationObserver(() => {
      if (resolved) return;
      const el = document.querySelector<HTMLElement>(step.selector);
      if (!el) return;
      const r = measureRect(el);
      if (!r) return;
      resolved = true;
      obs.disconnect();
      setRect(r);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const timeoutId = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      obs.disconnect();
      // Phần tử bỗng biến mất — đi tiếp.
      next();
    }, WAIT_TIMEOUT_MS);
    return () => {
      resolved = true;
      obs.disconnect();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, availableSteps]);

  // Phím tắt.
  useEffect(() => {
    if (phase !== "running") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, availableSteps]);

  const finish = useCallback(() => {
    if (tour) {
      try {
        localStorage.setItem(tour.storageKey, "1");
      } catch {
        /* ignore */
      }
    }
    setPhase("done");
  }, [tour]);

  const next = useCallback(() => {
    if (!availableSteps) return;
    if (stepIndex < availableSteps.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  }, [stepIndex, availableSteps, finish]);

  const prev = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  if (phase !== "running" || !rect || !availableSteps) return null;
  const step = availableSteps[stepIndex];
  if (!step) return null;

  // ── Tooltip placement ──────────────────────────────────────────────────
  const TOOLTIP_W = 340;
  const TOOLTIP_EST_H = 200;
  const GAP = 18;

  type Side = "right" | "left" | "bottom" | "top";
  let side: Side;
  if (rect.left + rect.width + GAP + TOOLTIP_W < vp.w - 16) side = "right";
  else if (rect.left - GAP - TOOLTIP_W > 16) side = "left";
  else if (rect.top + rect.height + GAP + TOOLTIP_EST_H < vp.h - 16)
    side = "bottom";
  else side = "top";

  let tooltipLeft: number;
  let tooltipTop: number;
  if (side === "right") {
    tooltipLeft = rect.left + rect.width + GAP;
    tooltipTop = Math.max(
      16,
      Math.min(
        vp.h - TOOLTIP_EST_H - 16,
        rect.top + rect.height / 2 - TOOLTIP_EST_H / 2,
      ),
    );
  } else if (side === "left") {
    tooltipLeft = rect.left - GAP - TOOLTIP_W;
    tooltipTop = Math.max(
      16,
      Math.min(
        vp.h - TOOLTIP_EST_H - 16,
        rect.top + rect.height / 2 - TOOLTIP_EST_H / 2,
      ),
    );
  } else if (side === "bottom") {
    tooltipLeft = Math.max(16, Math.min(vp.w - TOOLTIP_W - 16, rect.left));
    tooltipTop = rect.top + rect.height + GAP;
  } else {
    tooltipLeft = Math.max(16, Math.min(vp.w - TOOLTIP_W - 16, rect.left));
    tooltipTop = rect.top - GAP - TOOLTIP_EST_H;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      {/* Một motion duy nhất gánh cả ba lớp hiệu ứng (dim ngoài, viền,
          hào quang) bằng các box-shadow xếp chồng. Bấm vào vùng tối =
          đi tiếp. */}
      <motion.div
        aria-hidden
        className="pointer-events-auto absolute rounded-xl"
        initial={false}
        animate={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={FAST}
        style={{
          boxShadow: [
            "0 0 0 9999px rgba(15, 23, 42, 0.55)",
            "0 0 0 1px rgba(99, 102, 241, 0.5)",
            "0 0 24px 4px rgba(99, 102, 241, 0.45)",
          ].join(", "),
        }}
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      />

      <motion.div
        role="dialog"
        aria-live="polite"
        className="pointer-events-auto absolute rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
        initial={false}
        animate={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_W }}
        transition={FAST}
      >
        {side === "right" && (
          <div
            aria-hidden
            className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white ring-1 ring-slate-200"
            style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
          />
        )}
        {side === "left" && (
          <div
            aria-hidden
            className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white ring-1 ring-slate-200"
            style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
          />
        )}
        {side === "bottom" && (
          <div
            aria-hidden
            className="absolute left-6 -top-1.5 h-3 w-3 rotate-45 bg-white ring-1 ring-slate-200"
            style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
          />
        )}
        {side === "top" && (
          <div
            aria-hidden
            className="absolute left-6 -bottom-1.5 h-3 w-3 rotate-45 bg-white ring-1 ring-slate-200"
            style={{ clipPath: "polygon(100% 100%, 100% 0, 0 100%)" }}
          />
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Hướng dẫn nhanh
          </p>
          <span className="font-mono text-[10.5px] text-slate-400">
            {stepIndex + 1} / {availableSteps.length}
          </span>
        </div>

        <h3 className="mt-1.5 text-base font-bold tracking-tight text-slate-900">
          {step.title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
          {step.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Bỏ qua
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prev}
              disabled={stepIndex === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              {stepIndex === availableSteps.length - 1
                ? "Hoàn tất"
                : "Tiếp theo"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
