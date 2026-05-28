"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { getCurrentTenantContextForClient } from "@/app/actions/tenant-teachers";

// ── Cấu hình tour ───────────────────────────────────────────────────────────
//
// Tour đi theo 2 lớp: trỏ vào mục trong thanh bên, rồi đi sâu vào các tính
// năng bên trong từng mục. Bước nào không khớp với loại trung tâm hoặc vai
// trò người dùng sẽ bị lọc khỏi danh sách *trước khi* tour chạy.

type TenantKind = "CENTER" | "SCHOOL";
type Direction = "forward" | "backward";

interface TourStep {
  selector: string;
  page?: string;
  title: string;
  description: string;
  kinds?: readonly TenantKind[];
  hideForAdmin?: boolean;
}

const STEPS: TourStep[] = [
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
      "Tổng lương dự kiến, đã chi, số buổi đã / đang dạy — cập nhật tự động.",
    kinds: ["CENTER"],
  },
  {
    selector: '[data-tour-key="/dashboard/calendar"]',
    page: "/dashboard/calendar",
    title: "Lịch dạy",
    description:
      "Sắp xếp buổi học theo tuần hoặc tháng. Hệ thống tự cảnh báo khi giáo viên trùng giờ.",
    kinds: ["CENTER"],
  },
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
  {
    selector: '[data-tour-key="/dashboard/courses"]',
    page: "/dashboard/courses",
    title: "Khóa học",
    description:
      "Khai báo các khóa học và giáo viên phụ trách — dùng làm khuôn cho buổi dạy.",
    kinds: ["CENTER"],
  },
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
  {
    selector: '[data-tour-key="/dashboard/payouts"]',
    page: "/dashboard/payouts",
    title: "Nhận lương",
    description:
      "Khai báo cách giáo viên muốn nhận lương — chuyển khoản hoặc tiền mặt.",
    kinds: ["CENTER"],
    hideForAdmin: true,
  },
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
// Đã prefetch sẵn → đường dẫn DOM mới hầu như có ngay; cho một biên độ
// nhỏ để chờ phần tử in-page xuất hiện sau khi navigate.
const WAIT_TIMEOUT_MS = 1800;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
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

// ── Tham số animation ──────────────────────────────────────────────────────
//
// Một bộ transition duy nhất, ngắn + ease tự nhiên. Tránh spring vì spring
// có overshoot làm cảm giác "trễ" khi chuyển bước nhanh.
const FAST_EASE = [0.16, 1, 0.3, 1] as const; // ease-out-expo
const FAST = { duration: 0.32, ease: FAST_EASE };

// ── Component ───────────────────────────────────────────────────────────────

export function SidebarTour() {
  const router = useRouter();
  const pathname = usePathname();

  // Các pha hoạt động — gọn hơn nhiều cờ rời rạc.
  //   loading   = đang đợi context người dùng
  //   ready     = đã có context, đang quyết định bật / tắt
  //   running   = tour đang chạy
  //   done      = đã đóng (đã xem hoặc người dùng bỏ qua)
  const [phase, setPhase] = useState<"loading" | "ready" | "running" | "done">(
    "loading",
  );
  const [kind, setKind] = useState<TenantKind | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  // rect giữ lại giá trị cũ trong khi tour navigate sang trang mới → không
  // nhấp nháy / không "biến mất" khung sáng giữa các bước.
  const [rect, setRect] = useState<Rect | null>(null);

  const directionRef = useRef<Direction>("forward");

  // Lưu kích thước viewport trong ref (không gây re-render khi resize) và
  // chỉ force-render đúng một lần qua state `vp` sau khi đã debounce.
  const [vp, setVp] = useState({ w: 0, h: 0 });

  // Lọc danh sách bước theo loại trung tâm + vai trò người dùng.
  const steps = useMemo(() => {
    if (kind === null || isAdmin === null) return [];
    return STEPS.filter((s) => {
      if (s.kinds && !s.kinds.includes(kind)) return false;
      if (s.hideForAdmin && isAdmin) return false;
      return true;
    });
  }, [kind, isAdmin]);

  // ── 1. Lấy context (loại trung tâm + vai trò) ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    getCurrentTenantContextForClient().then((r) => {
      if (cancelled) return;
      if (r.success && r.data) {
        setKind(r.data.kind);
        setIsAdmin(r.data.isAdmin);
        setPhase("ready");
      } else {
        setPhase("done");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 2. Quyết định bật / tắt ngay khi context có ──────────────────────
  useEffect(() => {
    if (phase !== "ready") return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setPhase("done");
        return;
      }
    } catch {
      /* localStorage không dùng được — vẫn chạy */
    }
    setPhase("running");
  }, [phase]);

  // ── 3. Prefetch tất cả route mà tour sẽ đi qua ───────────────────────
  //
  // Đây là điểm tăng tốc quan trọng nhất. Sau prefetch, router.push() tới
  // các route đó dùng cache của RSC ngay lập tức → không thấy skeleton
  // loading.tsx nhấp nháy khi chuyển bước.
  useEffect(() => {
    if (phase !== "running") return;
    const seen = new Set<string>();
    for (const s of steps) {
      if (s.page && !seen.has(s.page)) {
        seen.add(s.page);
        router.prefetch(s.page);
      }
    }
  }, [phase, steps, router]);

  // ── 4. Viewport — debounce resize bằng rAF ───────────────────────────
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

  // Mobile bỏ qua (sidebar là drawer, không cố định để đo).
  useEffect(() => {
    if (phase === "running" && vp.w > 0 && vp.w < 1024) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, vp.w]);

  // ── 5. Tìm phần tử của bước hiện tại ─────────────────────────────────
  //
  // Logic:
  //   a) Nếu phải đổi trang (step.page khác pathname hiện tại) → push
  //      và quay lại sau khi pathname đổi. Giữ rect cũ để không nhấp
  //      nháy spotlight.
  //   b) Phần tử đã có trong DOM → đo ngay (synchronous, trong layout
  //      effect nên không bị FOUC).
  //   c) Chưa có → dùng MutationObserver bắt sự kiện DOM thay đổi thay
  //      vì poll mỗi 100ms (mất CPU + thêm độ trễ).
  useLayoutEffect(() => {
    if (phase !== "running") return;
    const step = steps[stepIndex];
    if (!step) return;

    // (a) cần đổi route trước
    if (step.page && pathname !== step.page) {
      router.push(step.page);
      return; // effect sẽ chạy lại khi pathname đổi
    }

    // (b) tìm ngay
    const direct = document.querySelector<HTMLElement>(step.selector);
    if (direct) {
      const r = measureRect(direct);
      if (r) {
        setRect(r);
        // Cuộn vào tầm nhìn cho các phần tử in-page, không cuộn cho
        // sidebar (sẽ làm sidebar tự kéo theo trông xấu).
        if (!step.selector.startsWith("[data-tour-key=")) {
          direct.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }

    // (c) chờ qua MutationObserver
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
      if (!step.selector.startsWith("[data-tour-key=")) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    const timeoutId = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      obs.disconnect();
      skipUnreachable();
    }, WAIT_TIMEOUT_MS);

    return () => {
      resolved = true;
      obs.disconnect();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, pathname, steps]);

  // Bỏ qua bước hiện tại — đi theo hướng cũ.
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

  // ── 6. Phím tắt ──────────────────────────────────────────────────────
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
  }, [phase, stepIndex]);

  // ── 7. Điều khiển ────────────────────────────────────────────────────

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("done");
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

  if (phase !== "running" || !rect || steps.length === 0) return null;
  const step = steps[stepIndex];
  if (!step) return null;

  // ── 8. Tooltip placement ─────────────────────────────────────────────
  //
  // Ưu tiên đặt bên phải; hết chỗ thì sang trái; bí quá thì xuống dưới.
  // Tính một lần per render, không cần useMemo cho phép tính rẻ này.
  const TOOLTIP_W = 340;
  const TOOLTIP_EST_H = 180;
  const GAP = 18;

  type Side = "right" | "left" | "bottom";
  let side: Side;
  if (rect.left + rect.width + GAP + TOOLTIP_W < vp.w - 16) side = "right";
  else if (rect.left - GAP - TOOLTIP_W > 16) side = "left";
  else side = "bottom";

  const tooltipPos =
    side === "right"
      ? {
          left: rect.left + rect.width + GAP,
          top: Math.max(
            16,
            Math.min(
              vp.h - TOOLTIP_EST_H - 16,
              rect.top + rect.height / 2 - TOOLTIP_EST_H / 2,
            ),
          ),
        }
      : side === "left"
        ? {
            left: rect.left - GAP - TOOLTIP_W,
            top: Math.max(
              16,
              Math.min(
                vp.h - TOOLTIP_EST_H - 16,
                rect.top + rect.height / 2 - TOOLTIP_EST_H / 2,
              ),
            ),
          }
        : {
            left: Math.max(16, Math.min(vp.w - TOOLTIP_W - 16, rect.left)),
            top: rect.top + rect.height + GAP,
          };

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      {/* Một motion duy nhất gánh cả 3 lớp hiệu ứng:
          – Vùng tối phủ ngoài  (box-shadow lớn)
          – Viền sáng           (box-shadow 1px indigo)
          – Hào quang mờ        (box-shadow blur lớn)
          Gộp vào một element vừa giảm số layer GPU vừa đảm bảo cả 3
          luôn đồng bộ tuyệt đối khi animate. */}
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

      {/* Tooltip — element thứ hai, di chuyển bằng top/left (framer
          chuyển sang transform internal để dùng GPU). */}
      <motion.div
        role="dialog"
        aria-live="polite"
        className="pointer-events-auto absolute rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
        initial={false}
        animate={{ ...tooltipPos, width: TOOLTIP_W }}
        transition={FAST}
      >
        {/* Mũi tên chỉ về phía phần tử được làm nổi bật */}
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
    </div>
  );
}
