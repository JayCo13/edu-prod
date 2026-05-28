"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Cấu hình tour ───────────────────────────────────────────────────────────
//
// Mỗi bước trỏ vào một mục trong sidebar (qua `data-tour-key=<href>`) và đi
// kèm một đoạn mô tả ngắn. Sidebar tự ẩn các mục không phù hợp theo vai
// trò / loại trung tâm — tour chỉ hiển thị các bước có sidebar item tương
// ứng đang nằm trong DOM, các bước khác tự bỏ qua.

interface TourStep {
  key: string; // khớp với href của mục sidebar
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    key: "/dashboard",
    title: "Trang chủ quản trị",
    description:
      "Đây là nơi bạn bắt đầu mỗi ngày — xem nhanh các con số quan trọng của trung tâm.",
  },
  {
    key: "/dashboard/calendar",
    title: "Lịch dạy",
    description:
      "Sắp xếp buổi học theo tuần hoặc tháng, hệ thống tự cảnh báo khi giáo viên trùng giờ.",
  },
  {
    key: "/dashboard/timetable",
    title: "Thời khoá biểu",
    description:
      "Xếp thời khoá biểu cho cả trường trên một bảng Thứ × Tiết, in hoặc chia sẻ mã QR cho học sinh.",
  },
  {
    key: "/dashboard/courses",
    title: "Khóa học",
    description:
      "Khai báo các khóa học, gán giáo viên phụ trách — dùng làm khuôn để tạo buổi dạy.",
  },
  {
    key: "/dashboard/teachers",
    title: "Giáo viên",
    description:
      "Thêm tài khoản cho giáo viên, đặt mức lương và xem lịch sử giảng dạy của từng người.",
  },
  {
    key: "/admin/payroll",
    title: "Bảng lương",
    description:
      "Cuối tháng tạo kỳ lương, hệ thống tự tính dựa trên buổi đã dạy và xuất file Excel gửi kế toán.",
  },
  {
    key: "/dashboard/payouts",
    title: "Nhận lương",
    description:
      "Khai báo cách bạn muốn nhận lương — chuyển khoản hoặc tiền mặt.",
  },
  {
    key: "/admin/settings",
    title: "Cài đặt",
    description:
      "Tên trung tâm, logo, ngày chốt lương và các thông số mặc định.",
  },
];

const STORAGE_KEY = "tour:admin:v1";

// Khoảng padding quanh ô được làm nổi bật (để khung sáng không sát mép).
const HIGHLIGHT_PADDING = 6;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export function SidebarTour() {
  // null = chưa kiểm tra localStorage (tránh nháy khi SSR);
  // false = không hiện; true = đang chạy tour.
  const [active, setActive] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Kiểm tra lần đầu — nếu chưa xem tour bao giờ thì bật.
  // Đợi thêm 600ms cho sidebar render xong + animation entrance dừng lại,
  // tránh việc đo vị trí khi item còn đang trượt vào.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY) === "1";
      if (seen) {
        setActive(false);
        return;
      }
    } catch {
      // localStorage không dùng được — vẫn chạy tour cho phiên này.
    }
    const t = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Cập nhật kích thước viewport — dùng để biết tour có chạy được không
  // (ẩn trên mobile vì sidebar là dạng trượt từ trái, không phải fixed).
  useEffect(() => {
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Tìm sidebar item của bước hiện tại; nếu DOM chưa có (mục đang ẩn theo
  // vai trò) thì tự nhảy sang bước kế tiếp.
  useLayoutEffect(() => {
    if (active !== true) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour-key="${step.key}"]`,
    );
    if (!el) {
      // Mục không có trong sidebar hiện tại — bỏ qua bước này.
      if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
      else finish();
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - HIGHLIGHT_PADDING,
      left: r.left - HIGHLIGHT_PADDING,
      width: r.width + HIGHLIGHT_PADDING * 2,
      height: r.height + HIGHLIGHT_PADDING * 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, viewport.w, viewport.h]);

  // Phím tắt: Esc bỏ qua, Enter / Mũi tên phải đi tiếp.
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

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  }

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else finish();
  }

  function prev() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  // Tour chỉ chạy trên desktop (sidebar cố định, có thể đo vị trí).
  // Dưới 1024px sidebar là drawer trượt — bỏ qua, đánh dấu seen luôn.
  useEffect(() => {
    if (active === true && viewport.w > 0 && viewport.w < 1024) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, viewport.w]);

  if (active !== true || !rect) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  // Vị trí tooltip — nằm bên phải sidebar item, căn giữa theo chiều dọc.
  // Nếu không đủ chỗ bên phải (viewport hẹp) thì đặt xuống dưới.
  const TOOLTIP_WIDTH = 320;
  const GAP = 18;
  const canPlaceRight = rect.left + rect.width + GAP + TOOLTIP_WIDTH < viewport.w;
  const tooltipLeft = canPlaceRight
    ? rect.left + rect.width + GAP
    : Math.max(16, rect.left);
  const tooltipTop = canPlaceRight
    ? Math.max(16, rect.top + rect.height / 2 - 80)
    : rect.top + rect.height + GAP;

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
        {/* Lớp tối phủ toàn màn hình, dùng box-shadow để "khoét" một ô
            sáng quanh sidebar item hiện tại. */}
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
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          style={{
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
          onClick={(e) => {
            // Click vào vùng tối thì đi tiếp. Click vào vùng sáng không
            // làm gì để người dùng vẫn thấy chính cái item.
            e.stopPropagation();
            next();
          }}
        />

        {/* Khung sáng phát quang quanh item — dùng layoutId để framer
            tự lo phần animate khi đổi bước. */}
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
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          style={{
            boxShadow:
              "0 0 0 1px rgba(99,102,241,0.4), 0 0 24px 4px rgba(99,102,241,0.45)",
          }}
        />

        {/* Tooltip nội dung — cũng dùng layoutId nên trượt theo cùng nhịp
            với khung sáng giữa các bước. */}
        <motion.div
          layoutId="tour-tooltip"
          role="dialog"
          aria-live="polite"
          className="absolute rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
          initial={false}
          animate={{
            top: tooltipTop,
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mũi tên nhỏ chỉ về phía sidebar item — chỉ vẽ khi đặt bên phải */}
          {canPlaceRight && (
            <div
              aria-hidden
              className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white ring-1 ring-slate-200"
              style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Hướng dẫn nhanh
            </p>
            <span className="font-mono text-[10.5px] text-slate-400">
              {stepIndex + 1} / {STEPS.length}
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
                {stepIndex === STEPS.length - 1 ? "Hoàn tất" : "Tiếp theo"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
