"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";

// ── Cấu hình tour ───────────────────────────────────────────────────────────
//
// Tour đi theo 2 lớp: trỏ vào mục trong thanh bên (sidebar), rồi đi sâu vào
// các tính năng bên trong từng mục. Mỗi bước nói rõ:
//   • `selector`  — CSS selector tới phần tử cần làm nổi bật
//   • `page`      — (tuỳ chọn) route phải đang ở; nếu không thì tour tự
//                   điều hướng sang bằng router.push()
//   • `kinds`     — chỉ chạy với loại trung tâm tương ứng (CENTER / SCHOOL).
//                   Bỏ trống = áp dụng cho cả hai.
//   • `hideForAdmin` — bỏ qua bước này nếu người dùng là quản trị viên.

type TenantKind = "CENTER" | "SCHOOL";

interface TourStep {
  selector: string;
  page?: string;
  title: string;
  description: string;
  kinds?: readonly TenantKind[];
  hideForAdmin?: boolean;
}

const STEPS: TourStep[] = [
  // ── Trang chủ ──────────────────────────────────────────────────────────
  {
    selector: '[data-tour-key="/dashboard"]',
    page: "/dashboard",
    title: "Trang chủ quản trị",
    description:
      "Đây là nơi bạn bắt đầu mỗi ngày. Bên dưới là các ô tổng hợp nhanh.",
  },
  {
    selector: '[data-tour="dashboard.today"]',
    page: "/dashboard",
    title: "Buổi học hôm nay",
    description:
      "Danh sách các buổi đang diễn ra trong ngày — giáo viên, giờ bắt đầu và trạng thái.",
    kinds: ["CENTER"],
  },
  {
    selector: '[data-tour="dashboard.today"]',
    page: "/dashboard",
    title: "Tổng quan trường",
    description:
      "Số lớp, số giáo viên, số môn và mức độ hoàn thành thời khoá biểu của trường.",
    kinds: ["SCHOOL"],
  },
  {
    selector: '[data-tour="dashboard.todo"]',
    page: "/dashboard",
    title: "Việc cần làm",
    description:
      "Các việc còn tồn đọng: giáo viên chưa cấu hình lương, kỳ lương chưa duyệt, hoá đơn chưa thanh toán.",
  },
  {
    selector: '[data-tour="dashboard.finance"]',
    page: "/dashboard",
    title: "Tổng quan tài chính tháng này",
    description:
      "Tổng lương dự kiến, đã chi, số buổi đã / đang dạy — cập nhật tự động khi có thay đổi.",
    kinds: ["CENTER"],
  },

  // ── Lịch dạy (chỉ trung tâm) ───────────────────────────────────────────
  {
    selector: '[data-tour-key="/dashboard/calendar"]',
    page: "/dashboard/calendar",
    title: "Lịch dạy",
    description:
      "Sắp xếp buổi học theo tuần hoặc tháng. Hệ thống tự cảnh báo khi giáo viên trùng giờ.",
    kinds: ["CENTER"],
  },

  // ── Thời khoá biểu (chỉ trường) ────────────────────────────────────────
  {
    selector: '[data-tour-key="/dashboard/timetable"]',
    page: "/dashboard/timetable",
    title: "Thời khoá biểu",
    description:
      "Xếp thời khoá biểu cho cả trường trên một bảng Thứ × Tiết, sau đó in hoặc chia sẻ mã QR.",
    kinds: ["SCHOOL"],
  },
  {
    selector: '[data-tour="tkb.editor-link"]',
    page: "/dashboard/timetable",
    title: "Trang xếp lịch",
    description:
      "Bấm vào đây để mở trang chính — kéo thả môn vào ô, sao chép giữa các lớp, hoàn tác / làm lại.",
    kinds: ["SCHOOL"],
  },

  // ── Khóa học (chỉ trung tâm) ───────────────────────────────────────────
  {
    selector: '[data-tour-key="/dashboard/courses"]',
    page: "/dashboard/courses",
    title: "Khóa học",
    description:
      "Khai báo các khóa học và giáo viên phụ trách — dùng làm khuôn cho buổi dạy.",
    kinds: ["CENTER"],
  },

  // ── Giáo viên (cả hai) ─────────────────────────────────────────────────
  {
    selector: '[data-tour-key="/dashboard/teachers"]',
    page: "/dashboard/teachers",
    title: "Giáo viên",
    description:
      "Danh sách đội ngũ giáo viên. Bạn có thể thêm mới, đặt mức lương và xem lịch sử dạy.",
  },
  {
    selector: '[data-tour="teachers.add"]',
    page: "/dashboard/teachers",
    title: "Thêm giáo viên mới",
    description:
      "Nhập email và mật khẩu tạm — giáo viên đổi mật khẩu trong vòng 24 giờ là dùng được tài khoản.",
  },

  // ── Bảng lương (chỉ trung tâm) ─────────────────────────────────────────
  {
    selector: '[data-tour-key="/admin/payroll"]',
    page: "/admin/payroll",
    title: "Bảng lương",
    description:
      "Cuối tháng tạo kỳ lương, hệ thống tự tính theo buổi đã dạy và xuất file Excel cho kế toán.",
    kinds: ["CENTER"],
  },
  {
    selector: '[data-tour="payroll.new-period"]',
    page: "/admin/payroll",
    title: "Tạo kỳ lương mới",
    description:
      "Chọn khoảng thời gian, hệ thống tự tổng hợp các buổi đã hoàn thành và tính số tiền cho từng giáo viên.",
    kinds: ["CENTER"],
  },

  // ── Nhận lương (chỉ giáo viên, không hiện cho admin) ───────────────────
  {
    selector: '[data-tour-key="/dashboard/payouts"]',
    page: "/dashboard/payouts",
    title: "Nhận lương",
    description:
      "Khai báo cách giáo viên muốn nhận lương — chuyển khoản hoặc tiền mặt.",
    kinds: ["CENTER"],
    hideForAdmin: true,
  },

  // ── Cài đặt (cả hai) ───────────────────────────────────────────────────
  {
    selector: '[data-tour-key="/admin/settings"]',
    page: "/admin/settings",
    title: "Cài đặt trung tâm",
    description:
      "Tên trung tâm, logo, ngày chốt lương và các thông số mặc định khác.",
  },
];

const STORAGE_KEY = "tour:admin:v3";

const HIGHLIGHT_PADDING = 6;

// Khi đến một bước, nếu phần tử chưa có trong DOM (vd. trang đang load
// sau khi router.push), poll lại mỗi 100ms tới giới hạn này.
const ELEMENT_WAIT_TIMEOUT_MS = 3000;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Direction = "forward" | "backward";

// ── Component ───────────────────────────────────────────────────────────────

export function SidebarTour() {
  const router = useRouter();
  const pathname = usePathname();

  // null = chưa kiểm tra localStorage; false = không hiện; true = đang chạy.
  const [active, setActive] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Loại trung tâm + vai trò người dùng. null = đang chờ kết quả từ server.
  // Phải lấy được trước khi quyết định danh sách bước nào áp dụng.
  const [kind, setKind] = useState<TenantKind | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Hướng đi hiện tại — dùng cho logic auto-skip khi phần tử không có
  // trong DOM. Ref để không kích hoạt re-render mỗi khi đổi hướng.
  const directionRef = useRef<Direction>("forward");

  // Danh sách bước thực tế áp dụng cho người dùng này.
  const steps = useMemo(() => {
    if (kind === null || isAdmin === null) return [];
    return STEPS.filter((s) => {
      if (s.kinds && !s.kinds.includes(kind)) return false;
      if (s.hideForAdmin && isAdmin) return false;
      return true;
    });
  }, [kind, isAdmin]);

  // Lấy context trung tâm (loại + vai trò) trước khi bật tour.
  useEffect(() => {
    let cancelled = false;
    getCurrentTenantContextForClient().then((r) => {
      if (cancelled) return;
      if (r.success && r.data) {
        setKind(r.data.kind);
        setIsAdmin(r.data.isAdmin);
      } else {
        // Không lấy được context — không chạy tour (tránh điều hướng lung
        // tung). User vẫn có thể vào từng mục thủ công.
        setActive(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bật tour lần đầu — chỉ sau khi đã có context. Đợi thêm 600ms cho
  // sidebar render xong rồi mới đo vị trí phần tử đầu tiên.
  useEffect(() => {
    if (kind === null || isAdmin === null) return;
    if (active !== null) return; // đã quyết định rồi
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setActive(false);
        return;
      }
    } catch {
      /* localStorage không dùng được — vẫn chạy */
    }
    const t = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(t);
  }, [kind, isAdmin, active]);

  // Theo dõi kích thước viewport.
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Mobile bỏ qua tour (sidebar là drawer, không cố định để đo).
  useEffect(() => {
    if (active === true && viewport.w > 0 && viewport.w < 1024) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, viewport.w]);

  // ── Tìm + đo phần tử của bước hiện tại ───────────────────────────────────
  //
  // Quy trình:
  //   1. Nếu step có `page` và ta đang ở route khác, gọi router.push tới
  //      đó trước.
  //   2. Poll DOM cho `step.selector` đến khi thấy hoặc hết thời gian.
  //   3. Nếu vẫn không thấy → auto-skip theo `directionRef`.
  //
  // useLayoutEffect để đo trước khi paint (rect không bị flash).
  useLayoutEffect(() => {
    if (active !== true) return;
    const step = steps[stepIndex];
    if (!step) return;

    // Cần điều hướng trước? Nếu có thì đợi pathname đổi rồi mới đo.
    if (step.page && pathname !== step.page) {
      router.push(step.page);
      // Khi pathname đổi, effect này sẽ tự re-run; trong lúc chờ, ẩn rect
      // để tooltip không nhảy giữa hai vị trí.
      setRect(null);
      return;
    }

    let cancelled = false;
    const startedAt = performance.now();

    function findAndMeasure() {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(step.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({
            top: r.top - HIGHLIGHT_PADDING,
            left: r.left - HIGHLIGHT_PADDING,
            width: r.width + HIGHLIGHT_PADDING * 2,
            height: r.height + HIGHLIGHT_PADDING * 2,
          });
          // Cuộn phần tử vào tầm nhìn (không lay sidebar — chỉ phần body)
          if (!step.selector.startsWith("[data-tour-key=")) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      }
      if (performance.now() - startedAt > ELEMENT_WAIT_TIMEOUT_MS) {
        // Hết kiên nhẫn — bỏ qua bước này theo hướng đang đi.
        skipUnreachable();
        return;
      }
      setTimeout(findAndMeasure, 100);
    }

    findAndMeasure();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, pathname, viewport.w, viewport.h, steps]);

  // Bỏ qua bước hiện tại khi không tìm được phần tử — đi theo hướng cũ.
  const skipUnreachable = useCallback(() => {
    if (directionRef.current === "backward") {
      if (stepIndex > 0) setStepIndex(stepIndex - 1);
      else finish();
    } else {
      if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
      else finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, steps.length]);

  // ── Phím tắt ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (active !== true) return;
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
  }, [active, stepIndex]);

  // ── Điều khiển ───────────────────────────────────────────────────────────

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  }

  function next() {
    directionRef.current = "forward";
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  }

  function prev() {
    directionRef.current = "backward";
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  if (active !== true || !rect) return null;
  if (steps.length === 0) return null;

  const step = steps[stepIndex];
  if (!step) return null;

  // ── Định vị tooltip ──────────────────────────────────────────────────────
  //
  // Ưu tiên đặt bên phải mục được làm nổi bật. Nếu không đủ chỗ (vd. mục
  // nằm sát mép phải), thử đặt bên trái. Cuối cùng mới đặt xuống dưới.
  const TOOLTIP_WIDTH = 340;
  const TOOLTIP_EST_HEIGHT = 180;
  const GAP = 18;

  type Side = "right" | "left" | "bottom";
  let side: Side;
  if (rect.left + rect.width + GAP + TOOLTIP_WIDTH < viewport.w - 16) {
    side = "right";
  } else if (rect.left - GAP - TOOLTIP_WIDTH > 16) {
    side = "left";
  } else {
    side = "bottom";
  }

  let tooltipLeft: number;
  let tooltipTop: number;
  if (side === "right") {
    tooltipLeft = rect.left + rect.width + GAP;
    tooltipTop = Math.max(
      16,
      Math.min(
        viewport.h - TOOLTIP_EST_HEIGHT - 16,
        rect.top + rect.height / 2 - TOOLTIP_EST_HEIGHT / 2,
      ),
    );
  } else if (side === "left") {
    tooltipLeft = rect.left - GAP - TOOLTIP_WIDTH;
    tooltipTop = Math.max(
      16,
      Math.min(
        viewport.h - TOOLTIP_EST_HEIGHT - 16,
        rect.top + rect.height / 2 - TOOLTIP_EST_HEIGHT / 2,
      ),
    );
  } else {
    tooltipLeft = Math.max(
      16,
      Math.min(viewport.w - TOOLTIP_WIDTH - 16, rect.left),
    );
    tooltipTop = rect.top + rect.height + GAP;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="tour-root"
        className="fixed inset-0 z-[120]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Phủ tối — khoét sáng quanh phần tử hiện tại bằng box-shadow */}
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
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
          style={{
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        />

        {/* Khung viền phát quang */}
        <motion.div
          layoutId="tour-spotlight-ring"
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-indigo-400/90 ring-offset-2 ring-offset-transparent"
          initial={false}
          animate={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
          style={{
            boxShadow:
              "0 0 0 1px rgba(99,102,241,0.4), 0 0 24px 4px rgba(99,102,241,0.45)",
          }}
        />

        {/* Hộp nội dung — trượt mượt giữa các bước nhờ layoutId */}
        <motion.div
          layoutId="tour-tooltip"
          role="dialog"
          aria-live="polite"
          className="absolute rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
          initial={false}
          animate={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mũi tên chỉ về phía phần tử */}
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

          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Hướng dẫn nhanh
            </p>
            <span className="font-mono text-[10.5px] text-slate-400">
              {stepIndex + 1} / {steps.length}
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
              Bỏ qua hướng dẫn
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
                {stepIndex === steps.length - 1 ? "Hoàn tất" : "Tiếp theo"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
