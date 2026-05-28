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

  // ── Thời khoá biểu — trang gốc ──────────────────────────────────────────
  //
  // Trang con `/editor` không có tour riêng — trang đó là vùng làm việc
  // chính, người dùng tự khám phá khi đã quen. Chỉ giữ một bước duy nhất
  // trên trang gốc, chỉ ngay đường đi tiếp theo.
  {
    prefix: "/dashboard/timetable",
    storageKey: "tour:timetable:v2",
    steps: [
      {
        selector: '[data-tour="tkb.tabs"]',
        title: "Quy trình xếp thời khoá biểu",
        description:
          "Khai báo Lớp → Môn → Khung tiết, rồi vào Trang xếp lịch để gán môn vào từng ô.",
      },
    ],
  },

  // ── Giáo viên ──────────────────────────────────────────────────────────
  //
  // Khi chưa có giáo viên nào, thanh lọc bị ẩn — tour tự còn lại đúng
  // một bước (nút Thêm). Khi đã có ít nhất một giáo viên, tour có cả
  // hai bước.
  {
    prefix: "/dashboard/teachers",
    storageKey: "tour:teachers:v3",
    steps: [
      {
        selector: '[data-tour="teachers.add"]',
        title: "Thêm giáo viên mới",
        description:
          "Nhập email và mật khẩu tạm cho giáo viên — họ có 24 giờ để đăng nhập và đổi mật khẩu là dùng được tài khoản. Sau khi tạo xong, bạn chọn cách tính lương (theo giờ, theo buổi, hoặc lương tháng cố định) ở trang chi tiết.",
      },
      {
        selector: '[data-tour="teachers.filters"]',
        title: "Lọc và tìm kiếm",
        description:
          "Gõ tên (không cần dấu — “nguyen” cũng tìm ra “Nguyễn”) hoặc lọc theo trạng thái và vai trò. Khu này chỉ hiện khi đã có giáo viên trong danh sách.",
      },
    ],
  },

  // Lịch dạy / Nhận lương / Khóa học không có tour riêng — các trang đó
  // có UI tự giải thích, thêm tooltip 1-bước "main" chỉ làm nặng thị giác.

  // ── Trang chủ ──────────────────────────────────────────────────────────
  //
  // Để cuối cùng vì prefix "/dashboard" trùng với rất nhiều route con —
  // pickTour() chọn match dài nhất nên các route con kể trên sẽ ưu tiên
  // tour của mình thay vì rơi vào tour Trang chủ này.
  //
  // Mỗi bước có selector riêng cho từng loại trung tâm (CENTER / SCHOOL).
  // Khi chạy, danh sách bước được lọc theo selector nào thực sự có trên
  // DOM, nên CENTER chỉ thấy 3 bước "today + todo + finance", SCHOOL chỉ
  // thấy 3 bước "overview + todo + grade-breakdown".
  {
    prefix: "/dashboard",
    storageKey: "tour:dashboard:v3",
    steps: [
      // ─ CENTER ─
      {
        selector: '[data-tour="dashboard.center.today"]',
        title: "Buổi học hôm nay",
        description:
          "Danh sách các buổi diễn ra trong ngày — giáo viên, giờ bắt đầu, trạng thái. Buổi bị huỷ được gạch ngang để dễ phân biệt.",
      },
      // ─ SCHOOL ─
      {
        selector: '[data-tour="dashboard.school.overview"]',
        title: "Tổng quan trường",
        description:
          "Số lớp, số giáo viên, số môn, số khung tiết — và quan trọng nhất là thanh tiến độ cho biết bạn đã xếp được bao nhiêu % thời khoá biểu của trường.",
      },
      // ─ Cả hai ─
      {
        selector: '[data-tour="dashboard.todo"]',
        title: "Việc cần làm",
        description:
          "Các việc còn tồn đọng — giáo viên chưa cấu hình lương, kỳ lương chưa duyệt, lớp chưa có giáo viên chủ nhiệm… Bấm vào dòng tương ứng để đi thẳng tới chỗ cần xử lý.",
      },
      // ─ CENTER ─
      {
        selector: '[data-tour="dashboard.center.finance"]',
        title: "Tổng quan tài chính tháng này",
        description:
          "Tổng lương dự kiến, số tiền đã chi, số buổi đã / đang dạy và số giáo viên hoạt động. Cập nhật tự động mỗi khi có thay đổi.",
      },
      // ─ SCHOOL ─
      {
        selector: '[data-tour="dashboard.grade-breakdown"]',
        title: "Thời khoá biểu theo khối",
        description:
          "Tóm tắt tình trạng xếp lịch của từng khối: số lớp, số tiết đã xếp, % có giáo viên chủ nhiệm. Bấm vào một khối để vào thẳng trang xếp lịch của khối đó.",
      },
    ],
  },
];

const HIGHLIGHT_PADDING = 6;
// Đợi tối đa cho phần tử xuất hiện sau khi đổi trang. Đủ lâu để vượt qua
// loading.tsx skeleton + dữ liệu server-rendered, nhưng đủ ngắn để
// không treo tour mãi nếu trang thực sự không có anchor nào.
const WAIT_TIMEOUT_MS = 4000;
// Sau khi anchor đầu tiên xuất hiện, đợi thêm một khoảng ngắn để các
// motion entrance (WidgetCard fade-in, framer staggers) hoàn tất và
// vị trí cuối cùng ổn định. Không có khoảng này tour có thể hiện ngay
// khi card vẫn đang trượt vào, làm spotlight bám sai chỗ.
const SETTLE_AFTER_FIRST_MS = 350;
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

  // Đợi DOM thực sự sẵn sàng rồi mới quét anchor.
  //
  // Trước: setTimeout 250ms cố định — bị lỗi khi trang có loading.tsx
  // skeleton (skeleton render trước, anchor chưa xuất hiện) hoặc khi
  // server-fetched data trả về chậm. Trang Giáo viên bị ảnh hưởng vì
  // loading.tsx phủ toàn bộ vùng main, không có anchor nào.
  //
  // Giờ: MutationObserver theo dõi DOM tới khi có ít nhất một anchor
  // của tour này xuất hiện với rect hợp lệ → quét toàn bộ. Có timeout
  // an toàn (WAIT_TIMEOUT_MS) phòng trường hợp anchor không bao giờ có.
  const [availableSteps, setAvailableSteps] = useState<TourStep[] | null>(null);
  useEffect(() => {
    if (!tour) {
      setAvailableSteps([]);
      return;
    }
    setAvailableSteps(null);

    function scan(): TourStep[] {
      const present: TourStep[] = [];
      for (const s of tour!.steps) {
        const el = document.querySelector<HTMLElement>(s.selector);
        if (el && el.getBoundingClientRect().width > 0) present.push(s);
      }
      return present;
    }

    let resolved = false;
    let settleId: ReturnType<typeof setTimeout> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let obs: MutationObserver | null = null;

    // Khi đã phát hiện được ít nhất một anchor, vẫn đợi thêm một khoảng
    // ngắn cho các anchor khác (vd. cards có entrance stagger) + cho
    // motion ổn định xong, rồi mới quét lần cuối → đảm bảo rect đo
    // đúng vị trí cuối cùng, không phải vị trí giữa animation.
    function finalize() {
      if (resolved) return;
      resolved = true;
      obs?.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      settleId = setTimeout(() => {
        setAvailableSteps(scan());
      }, SETTLE_AFTER_FIRST_MS);
    }

    // Quét lần đầu — phần lớn các trang render kịp ngay.
    if (scan().length > 0) {
      finalize();
    } else {
      // Chưa thấy anchor → theo dõi DOM. Lần đầu thấy anchor → finalize().
      obs = new MutationObserver(() => {
        if (resolved) return;
        if (scan().length > 0) finalize();
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-tour"],
      });

      // An toàn: hết thời gian chờ vẫn không có anchor → kết thúc nhẹ.
      timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        obs?.disconnect();
        setAvailableSteps(scan());
      }, WAIT_TIMEOUT_MS);
    }

    return () => {
      resolved = true;
      obs?.disconnect();
      if (settleId) clearTimeout(settleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
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

  // Đo + theo dõi phần tử của bước hiện tại.
  //
  // Theo dõi 3 nguồn thay đổi vị trí:
  //   1. ResizeObserver trên chính phần tử — bắt được khi nội dung của
  //      phần tử mở rộng / co lại.
  //   2. ResizeObserver trên <body> — bắt được khi layout xung quanh
  //      đổi (sidebar collapse, viewport resize, font load…)
  //   3. scroll event — chỉ cần re-measure top/left, không cần
  //      observer; getBoundingClientRect trả vị trí theo viewport.
  //
  // Spotlight (position: fixed) cần toạ độ viewport-relative, nên scroll
  // làm dịch chuyển và phải cập nhật.
  useLayoutEffect(() => {
    if (phase !== "running" || !availableSteps) return;
    const step = availableSteps[stepIndex];
    if (!step) return;

    let currentEl: HTMLElement | null = null;
    let raf = 0;

    function measureAndSet(el: HTMLElement) {
      const r = measureRect(el);
      if (r) setRect(r);
    }

    function scheduleMeasure() {
      if (!currentEl) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (currentEl) measureAndSet(currentEl);
      });
    }

    const elObs = new ResizeObserver(scheduleMeasure);
    const bodyObs = new ResizeObserver(scheduleMeasure);

    function attach(el: HTMLElement) {
      currentEl = el;
      measureAndSet(el);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      elObs.observe(el);
      bodyObs.observe(document.body);
      window.addEventListener("scroll", scheduleMeasure, { passive: true });
      window.addEventListener("resize", scheduleMeasure, { passive: true });
    }

    const direct = document.querySelector<HTMLElement>(step.selector);
    if (direct && direct.getBoundingClientRect().width > 0) {
      attach(direct);
    } else {
      // Phần tử chưa có — chờ xuất hiện rồi attach.
      let resolved = false;
      const waitObs = new MutationObserver(() => {
        if (resolved) return;
        const el = document.querySelector<HTMLElement>(step.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return;
        resolved = true;
        waitObs.disconnect();
        attach(el);
      });
      waitObs.observe(document.body, { childList: true, subtree: true });

      const timeoutId = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        waitObs.disconnect();
        next();
      }, WAIT_TIMEOUT_MS);

      return () => {
        resolved = true;
        waitObs.disconnect();
        clearTimeout(timeoutId);
        elObs.disconnect();
        bodyObs.disconnect();
        window.removeEventListener("scroll", scheduleMeasure);
        window.removeEventListener("resize", scheduleMeasure);
        cancelAnimationFrame(raf);
      };
    }

    return () => {
      currentEl = null;
      elObs.disconnect();
      bodyObs.disconnect();
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      cancelAnimationFrame(raf);
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
