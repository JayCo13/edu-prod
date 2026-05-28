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
    storageKey: "intro:calendar:v2",
    eyebrow: "Lịch dạy",
    title: "Sắp xếp buổi học cho cả trung tâm",
    subtitle:
      "Xem lịch theo tuần hoặc tháng, tự cảnh báo trùng giáo viên, tạo buổi nhanh và xuất sang lịch cá nhân của giáo viên.",
    cards: [
      {
        icon: CalendarDays,
        title: "Tạo buổi nhanh",
        desc: "Bấm vào ô trống trên lịch để mở khung tạo buổi — chọn lớp, giáo viên và khung giờ.",
      },
      {
        icon: Sparkles,
        title: "Cảnh báo trùng giờ",
        desc: "Khi một giáo viên hoặc phòng đã có buổi khác cùng khung giờ, hệ thống tự báo trước khi lưu.",
      },
      {
        icon: ArrowUpRight,
        title: "Xuất lịch cá nhân",
        desc: "Tải file lịch để giáo viên thêm vào Lịch Google, Lịch Apple hoặc các ứng dụng lịch khác.",
      },
    ],
  },
  {
    prefix: "/dashboard/timetable",
    storageKey: "intro:timetable:v2",
    eyebrow: "Thời khoá biểu",
    title: "Xếp thời khoá biểu cả trường trên một bảng",
    subtitle:
      "Khai báo Lớp · Môn · Tiết, kéo thả vào bảng Thứ × Tiết, rồi tải về file Excel, PDF hoặc chia sẻ mã QR cho học sinh.",
    cards: [
      {
        icon: ListTree,
        title: "Khai báo Lớp · Môn · Tiết",
        desc: "Nhập danh sách lớp, môn học và các tiết trong ngày một lần — dùng cho cả năm học.",
        href: "/dashboard/timetable/classes",
        hrefLabel: "Khai báo",
      },
      {
        icon: LayoutDashboard,
        title: "Trang xếp thời khoá biểu",
        desc: "Quét nhanh một môn vào nhiều ô, chọn nhiều ô để gán cùng lúc, sao chép từ lớp này sang lớp khác, hoàn tác / làm lại và gợi ý giáo viên phù hợp.",
        href: "/dashboard/timetable/editor",
        hrefLabel: "Mở trang xếp lịch",
      },
      {
        icon: QrCode,
        title: "Mã QR cho học sinh",
        desc: "Mã QR cố định, học sinh quét là thấy thời khoá biểu mới nhất — sửa lịch không cần tạo lại mã.",
      },
      {
        icon: FileSpreadsheet,
        title: "Xuất Excel hoặc PDF",
        desc: "Định dạng đúng quy ước Việt Nam (Thứ × Tiết), gồm cả buổi sáng và buổi chiều trong một file.",
      },
    ],
  },
  {
    prefix: "/dashboard/teachers",
    storageKey: "intro:teachers:v2",
    eyebrow: "Giáo viên",
    title: "Quản lý đội ngũ giáo viên",
    subtitle:
      "Tạo tài khoản giáo viên với mật khẩu tạm thời, đặt cách tính lương và xem lại lịch sử giảng dạy.",
    cards: [
      {
        icon: UserPlus,
        title: "Thêm giáo viên",
        desc: "Nhập email và mật khẩu tạm — giáo viên đổi mật khẩu trong vòng 24 giờ là dùng được tài khoản.",
      },
      {
        icon: Wallet,
        title: "Cách tính lương",
        desc: "Chọn một trong ba kiểu: theo giờ, theo buổi, hoặc lương tháng cố định — đặt một lần để dùng khi chi lương.",
      },
      {
        icon: History,
        title: "Lịch sử giảng dạy",
        desc: "Xem các buổi giáo viên đã dạy, tổng số giờ và tổng lương đã chi qua từng tháng.",
      },
    ],
  },
  {
    prefix: "/dashboard/courses",
    storageKey: "intro:courses:v2",
    eyebrow: "Khóa học",
    title: "Danh mục khóa học của trung tâm",
    subtitle:
      "Khai báo các khóa học, chọn giáo viên phụ trách — dùng làm khuôn để tạo buổi dạy nhanh ở mục Lịch dạy.",
    cards: [
      {
        icon: GraduationCap,
        title: "Tạo khóa học",
        desc: "Đặt tên, mô tả, số buổi và giáo viên — lưu lại làm khuôn để dùng cho các buổi học sau.",
      },
      {
        icon: Users,
        title: "Học viên",
        desc: "Ghi danh học viên vào khóa, theo dõi sĩ số lớp và tiến độ học của từng người.",
      },
    ],
  },
  {
    prefix: "/admin/payroll",
    storageKey: "intro:payroll:v2",
    eyebrow: "Bảng lương",
    title: "Tính lương tự động cho cả trung tâm",
    subtitle:
      "Kết quả khớp 100% với cách tính Excel thủ công — tổng hợp buổi đã dạy, áp dụng mức lương, cộng / trừ điều chỉnh và xuất file gửi kế toán.",
    cards: [
      {
        icon: CreditCard,
        title: "Tạo kỳ lương",
        desc: "Chọn khoảng thời gian, hệ thống tự tổng hợp toàn bộ buổi đã hoàn thành của từng giáo viên.",
      },
      {
        icon: ClipboardList,
        title: "Duyệt và điều chỉnh",
        desc: "Sửa số tiền cuối cùng kèm lý do — hệ thống tự lưu lại ai đã sửa, sửa gì và sửa lúc nào.",
      },
      {
        icon: FileSpreadsheet,
        title: "Xuất file Excel",
        desc: "Định dạng đúng chuẩn kế toán Việt Nam (1.000.000đ, dấu cộng / trừ rõ ràng).",
      },
      {
        icon: History,
        title: "Nhật ký thay đổi",
        desc: "Mọi chỉnh sửa sau khi duyệt đều được ghi lại — không ai sửa lén được.",
      },
    ],
  },
  {
    prefix: "/dashboard/payouts",
    storageKey: "intro:payouts:v2",
    eyebrow: "Nhận lương",
    title: "Thông tin nhận lương của bạn",
    subtitle:
      "Khai báo cách bạn muốn nhận lương (chuyển khoản ngân hàng hoặc tiền mặt) — quản trị viên sẽ thấy khi chi lương cho bạn.",
    cards: [
      {
        icon: Wallet,
        title: "Tài khoản ngân hàng",
        desc: "Tên ngân hàng và số tài khoản. Quản trị viên chỉ thấy 4 số cuối để đối chiếu.",
      },
      {
        icon: History,
        title: "Lịch sử nhận lương",
        desc: "Các kỳ lương đã được duyệt, ngày thanh toán và ghi chú từ quản trị viên.",
      },
    ],
  },
  {
    prefix: "/admin/settings",
    storageKey: "intro:settings:v2",
    eyebrow: "Cài đặt",
    title: "Cài đặt trung tâm",
    subtitle:
      "Đặt tên trung tâm, tải logo, chọn ngày chốt lương và các thông số mặc định khi tính lương.",
    cards: [
      {
        icon: Settings,
        title: "Thông tin chung",
        desc: "Tên và logo của trung tâm — hiển thị trên email gửi giáo viên, file PDF và trang xem thời khoá biểu công khai.",
      },
      {
        icon: Wallet,
        title: "Ngày chốt lương",
        desc: "Ngày trong tháng để kết thúc kỳ lương (mặc định là ngày 1 của tháng kế tiếp).",
      },
    ],
  },
  {
    prefix: "/dashboard",
    storageKey: "intro:dashboard:v2",
    eyebrow: "Bắt đầu",
    title: "Chào mừng bạn đến với VLearning",
    subtitle:
      "Đây là trang chủ quản trị. Mở từng mục ở thanh bên trái — mỗi mục có phần giới thiệu riêng để bạn biết có thể làm gì ở đó.",
    cards: [
      {
        icon: UserCog,
        title: "1. Thêm giáo viên",
        desc: "Tạo tài khoản cho đội ngũ — giáo viên đăng nhập là dùng được ngay trên điện thoại.",
        href: "/dashboard/teachers",
        hrefLabel: "Thêm giáo viên",
      },
      {
        icon: Calendar,
        title: "2. Sắp xếp lịch dạy",
        desc: "Tạo buổi học cho trung tâm hoặc xếp thời khoá biểu tuần cho trường.",
      },
      {
        icon: Wallet,
        title: "3. Tính lương cuối tháng",
        desc: "Tạo kỳ lương, hệ thống tự tính, xuất file Excel gửi kế toán.",
        href: "/admin/payroll",
        hrefLabel: "Mở bảng lương",
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
