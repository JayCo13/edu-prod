"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutDashboard,
  ListTree,
  QrCode,
  Settings,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

// ── Feature config per top-level admin section ──────────────────────────────
//
// Each entry maps a pathname prefix to the panel content shown the first
// time the user lands there. Keep one config per *sidebar tab* — children
// (e.g. /admin/payroll/[id]) inherit from the parent prefix.

interface FeatureCard {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href?: string;
  hrefLabel?: string;
}

interface FeatureIntro {
  /** Path prefix to match (`startsWith`). Most specific wins. */
  prefix: string;
  /** localStorage key — change to re-show a previously-dismissed panel. */
  storageKey: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: FeatureCard[];
}

const INTROS: FeatureIntro[] = [
  {
    prefix: "/dashboard/calendar",
    storageKey: "intro:calendar:v1",
    eyebrow: "Lịch dạy",
    title: "Sắp xếp buổi học cho cả trung tâm",
    subtitle:
      "Lịch theo tuần / tháng, phát hiện trùng giáo viên, tạo buổi nhanh và xuất ra lịch cá nhân.",
    cards: [
      {
        icon: CalendarDays,
        title: "Tạo buổi nhanh",
        desc: "Click vào ô trống để mở form tạo buổi — chọn lớp, giáo viên, khung giờ.",
      },
      {
        icon: Sparkles,
        title: "Phát hiện trùng lịch",
        desc: "Hệ thống tự cảnh báo khi giáo viên / phòng đã có buổi khác cùng khung.",
      },
      {
        icon: ArrowUpRight,
        title: "Xuất .ics",
        desc: "Tải lịch về Google Calendar, Apple Calendar hoặc gửi cho giáo viên.",
      },
    ],
  },
  {
    prefix: "/dashboard/timetable",
    storageKey: "intro:timetable:v1",
    eyebrow: "Thời khoá biểu",
    title: "Xếp TKB cả trường trong một grid",
    subtitle:
      "Định nghĩa Lớp · Môn · Khung tiết, gán vào lưới Thứ × Tiết, rồi xuất Excel / PDF / QR cho học sinh.",
    cards: [
      {
        icon: ListTree,
        title: "Định nghĩa khung",
        desc: "Khai báo các Lớp, Môn học, Khung tiết một lần — dùng cho cả năm.",
        href: "/dashboard/timetable/classes",
        hrefLabel: "Lớp · Môn · Tiết",
      },
      {
        icon: LayoutDashboard,
        title: "Editor lưới",
        desc: "Brush mode, multi-select, copy lớp → lớp, Undo/Redo, gợi ý giáo viên thông minh.",
        href: "/dashboard/timetable/editor",
        hrefLabel: "Mở Editor",
      },
      {
        icon: QrCode,
        title: "Chia sẻ QR học sinh",
        desc: "Mã QR cố định, học sinh quét xem TKB live — sửa lịch không cần tạo lại.",
      },
      {
        icon: FileSpreadsheet,
        title: "Xuất Excel / PDF",
        desc: "Layout chuẩn Việt Nam (Thứ × Tiết), bao gồm cả buổi Sáng và Chiều.",
      },
    ],
  },
  {
    prefix: "/dashboard/teachers",
    storageKey: "intro:teachers:v1",
    eyebrow: "Giáo viên",
    title: "Quản lý đội ngũ giáo viên",
    subtitle:
      "Tạo tài khoản giáo viên với mật khẩu tạm 24h, theo dõi rate, và xem lịch sử dạy.",
    cards: [
      {
        icon: UserPlus,
        title: "Thêm giáo viên",
        desc: "Email + mật khẩu tạm → giáo viên đổi pass trong 24h là tự đăng nhập được.",
      },
      {
        icon: Wallet,
        title: "Cấu trúc lương",
        desc: "HOURLY · PER_SESSION · FIXED_MONTHLY — set một lần dùng cho payroll.",
      },
      {
        icon: History,
        title: "Lịch sử dạy",
        desc: "Xem các buổi đã dạy, tổng giờ, tổng lương đã chi từng tháng.",
      },
    ],
  },
  {
    prefix: "/dashboard/courses",
    storageKey: "intro:courses:v1",
    eyebrow: "Khóa học",
    title: "Catalog khóa học của trung tâm",
    subtitle:
      "Định nghĩa khóa học, gán giáo viên phụ trách, dùng làm khung cho Lịch dạy.",
    cards: [
      {
        icon: GraduationCap,
        title: "Tạo khóa học",
        desc: "Tên, mô tả, số buổi, giáo viên — làm template cho các buổi học sau.",
      },
      {
        icon: Users,
        title: "Học viên",
        desc: "Đăng ký học viên vào khóa, quản lý lớp, theo dõi tiến độ.",
      },
    ],
  },
  {
    prefix: "/admin/payroll",
    storageKey: "intro:payroll:v1",
    eyebrow: "Bảng lương",
    title: "Tính lương tự động · Killer feature",
    subtitle:
      "Engine tính chuẩn 100% như Excel thủ công — gom buổi đã dạy, áp rate, cộng/trừ điều chỉnh, xuất file gửi kế toán.",
    cards: [
      {
        icon: CreditCard,
        title: "Tạo kỳ lương",
        desc: "Chọn khoảng thời gian → hệ thống tự gom tất cả buổi COMPLETED của mọi giáo viên.",
      },
      {
        icon: ClipboardList,
        title: "Duyệt + điều chỉnh",
        desc: "Sửa final_amount kèm lý do, audit log lưu lại ai sửa gì lúc nào.",
      },
      {
        icon: FileSpreadsheet,
        title: "Xuất Excel",
        desc: "Định dạng chuẩn kế toán Việt Nam (1.000.000đ, ký hiệu âm/dương rõ ràng).",
      },
      {
        icon: History,
        title: "Audit log",
        desc: "Mọi thay đổi sau khi duyệt đều được ghi lại — không sửa lén được.",
      },
    ],
  },
  {
    prefix: "/dashboard/payouts",
    storageKey: "intro:payouts:v1",
    eyebrow: "Nhận lương",
    title: "Thông tin nhận lương của bạn",
    subtitle:
      "Kê khai phương thức nhận lương (ngân hàng / tiền mặt) — admin sẽ thấy khi chi lương.",
    cards: [
      {
        icon: Wallet,
        title: "Tài khoản ngân hàng",
        desc: "Tên ngân hàng + số tài khoản. Admin chỉ thấy 4 số cuối để tra cứu.",
      },
      {
        icon: History,
        title: "Lịch sử chi lương",
        desc: "Các kỳ đã được duyệt + ngày thanh toán + ghi chú từ admin.",
      },
    ],
  },
  {
    prefix: "/admin/settings",
    storageKey: "intro:settings:v1",
    eyebrow: "Cài đặt",
    title: "Cài đặt trung tâm",
    subtitle:
      "Tên trung tâm, logo, ngày chốt lương, và các tham số tính lương mặc định.",
    cards: [
      {
        icon: Settings,
        title: "Thông tin chung",
        desc: "Tên trung tâm hiển thị trên email, PDF, trang public TKB.",
      },
      {
        icon: Wallet,
        title: "Chu kỳ lương",
        desc: "Ngày trong tháng kết thúc kỳ lương (mặc định ngày 1 tháng kế tiếp).",
      },
    ],
  },
  {
    prefix: "/dashboard",
    storageKey: "intro:dashboard:v1",
    eyebrow: "Bắt đầu",
    title: "Chào mừng đến VLearning",
    subtitle:
      "Đây là trang chủ admin. Mở từng mục ở sidebar bên trái — mỗi mục có giới thiệu tính năng riêng.",
    cards: [
      {
        icon: UserCog,
        title: "1. Thêm giáo viên",
        desc: "Tạo tài khoản cho đội ngũ — giáo viên đăng nhập là dùng được mobile view.",
        href: "/dashboard/teachers",
        hrefLabel: "Mở",
      },
      {
        icon: Calendar,
        title: "2. Xếp lịch / TKB",
        desc: "Tạo buổi học (CENTER) hoặc xếp Thời khoá biểu tuần (SCHOOL).",
      },
      {
        icon: Wallet,
        title: "3. Tính lương",
        desc: "Cuối tháng tạo kỳ lương, engine tự tính, xuất Excel gửi kế toán.",
        href: "/admin/payroll",
        hrefLabel: "Bảng lương",
      },
    ],
  },
];

// Pick the most-specific (longest) prefix match.
function pickIntro(pathname: string): FeatureIntro | null {
  let best: FeatureIntro | null = null;
  for (const intro of INTROS) {
    if (pathname === intro.prefix || pathname.startsWith(intro.prefix + "/")) {
      if (!best || intro.prefix.length > best.prefix.length) best = intro;
    }
  }
  return best;
}

// ── Animation variants ──────────────────────────────────────────────────────

const panelVariants = {
  hidden: { opacity: 0, y: -12, height: 0 },
  show: {
    opacity: 1,
    y: 0,
    height: "auto",
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: { duration: 0.25, ease: "easeIn" as const },
  },
};

const cardContainerVariants = {
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: -24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export function FeatureIntro() {
  const pathname = usePathname();
  const intro = useMemo(() => pickIntro(pathname || ""), [pathname]);

  // null = not yet checked localStorage (avoids SSR/CSR mismatch flash);
  // true/false = should/shouldn't show.
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!intro) {
      setVisible(false);
      return;
    }
    try {
      const dismissed = localStorage.getItem(intro.storageKey) === "1";
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [intro]);

  function handleDismiss() {
    if (!intro) return;
    try {
      localStorage.setItem(intro.storageKey, "1");
    } catch {
      // localStorage unavailable (private window, quota) — still hide for
      // this session.
    }
    setVisible(false);
  }

  if (!intro) return null;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          key={intro.storageKey}
          variants={panelVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          className="mb-6 overflow-hidden"
        >
          <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/40 p-5 shadow-sm">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Ẩn giới thiệu"
              title="Ẩn (không hiện lại)"
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="max-w-3xl">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                {intro.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {intro.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {intro.subtitle}
              </p>
            </div>

            <motion.div
              variants={cardContainerVariants}
              initial="hidden"
              animate="show"
              className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {intro.cards.map((card, i) => {
                const Inner = (
                  <>
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition-transform group-hover:-rotate-3 group-hover:scale-105">
                      <card.icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-[13.5px] font-bold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                      {card.desc}
                    </p>
                    {card.href && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600">
                        {card.hrefLabel ?? "Mở"}
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </>
                );
                const cardClass =
                  "group relative flex h-full flex-col rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md";
                return (
                  <motion.div
                    key={`${intro.storageKey}-${i}`}
                    variants={cardVariants}
                  >
                    {card.href ? (
                      <Link href={card.href} className={cardClass}>
                        {Inner}
                      </Link>
                    ) : (
                      <div className={cardClass}>{Inner}</div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
