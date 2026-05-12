import type { ProfileLayout } from "@/lib/profile-schema";

export const SAMPLE_TEACHER = {
  name: "Cô Trần Thị Hương",
  role: "Giáo viên Toán THPT",
  students: "28,420",
  tagline: "Cùng bạn chinh phục đề thi THPT Quốc gia 2026.",
  initials: "TH",
  location: "Hà Nội · MMXXVI",
};

export const SAMPLE_BIO =
  "Tôi là giáo viên Toán THPT với hơn 12 năm kinh nghiệm luyện thi đại học khối A, A1 và D. Phương pháp của tôi đặt nặng tư duy hình học và logic hơn việc ghi nhớ công thức — học sinh hiểu được câu chuyện đằng sau mỗi bài toán, từ đó tự xây dựng cách giải. Trong các năm học vừa qua, hơn 2,400 học sinh đã đỗ vào các trường top đầu: Y Hà Nội, Bách Khoa, Ngoại Thương, Kinh tế Quốc dân.";

export const SAMPLE_PULLQUOTE =
  "Toán không phải để thuộc — Toán là để hiểu, một lần, là đủ.";

export type SampleCourse = {
  id: number;
  title: string;
  level: string;
  price: string;
  oldPrice: string | null;
  students: number;
  /** Aggregate rating; omit until a reviews/ratings system exists. */
  rating?: number;
  hue: "indigo" | "amber" | "rose" | "emerald" | "sky" | "violet";
  featured?: boolean;
  live?: boolean;
};

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    id: 1,
    title: "Toán 12 — Luyện thi THPT Quốc gia",
    level: "Lớp 12 · 84 bài",
    price: "₫1,290,000",
    oldPrice: "₫1,890,000",
    students: 2418,
    rating: 4.9,
    hue: "indigo",
    featured: true,
  },
  {
    id: 2,
    title: "Hình học không gian · Lớp 12.B",
    level: "Chuyên đề · 32 bài",
    price: "₫690,000",
    oldPrice: null,
    students: 1124,
    rating: 4.8,
    hue: "amber",
  },
  {
    id: 3,
    title: "Lớp Live · Hàm số bậc 2",
    level: "Live · Hàng tuần",
    price: "₫390,000",
    oldPrice: null,
    students: 642,
    rating: 4.9,
    hue: "rose",
    live: true,
  },
  {
    id: 4,
    title: "Đề minh hoạ 2026 · Phân tích",
    level: "Cấp tốc · 12 bài",
    price: "Miễn phí",
    oldPrice: null,
    students: 4218,
    rating: 5.0,
    hue: "emerald",
  },
  {
    id: 5,
    title: "Tổ hợp & Xác suất — Trắc nghiệm",
    level: "Cơ bản · 18 bài",
    price: "₫490,000",
    oldPrice: "₫690,000",
    students: 856,
    rating: 4.8,
    hue: "sky",
  },
  {
    id: 6,
    title: "Ôn luyện Đại số — Lớp 11",
    level: "Lớp 11 · 28 bài",
    price: "₫790,000",
    oldPrice: null,
    students: 1240,
    rating: 4.7,
    hue: "violet",
  },
];

export const SAMPLE_CONTACT = {
  email: "huong.tran@thaytoan.vn",
  socials: [
    { id: "fb" as const, label: "Facebook", handle: "fb.com/cohuongtoan" },
    { id: "yt" as const, label: "YouTube", handle: "youtube.com/@cohuong" },
    { id: "tt" as const, label: "TikTok", handle: "tiktok.com/@cohuongtoan" },
  ],
};

export const DEFAULT_LAYOUT: ProfileLayout = {
  accent: "rose",
  modules: [
    {
      type: "hero",
      visible: true,
      variant: "split",
      content: {
        name: SAMPLE_TEACHER.name,
        role: SAMPLE_TEACHER.role,
        tagline: SAMPLE_TEACHER.tagline,
        primaryCtaLabel: "Xem khóa học",
        primaryCtaHref: "#courses",
        secondaryCtaLabel: "Liên hệ",
        secondaryCtaHref: "#contact",
        experienceYears: "12 năm",
        location: SAMPLE_TEACHER.location,
        achievement: "2,400+ học sinh đỗ ĐH top đầu",
      },
    },
    {
      type: "about",
      visible: true,
      content: { body: SAMPLE_BIO, withQuote: true, quote: SAMPLE_PULLQUOTE },
    },
    {
      type: "featured",
      visible: true,
      variant: "grid3",
      content: { courseIds: [1, 2, 3] },
    },
    {
      type: "contact",
      visible: true,
      content: {
        email: SAMPLE_CONTACT.email,
        socials: SAMPLE_CONTACT.socials,
        withCapture: true,
      },
    },
  ],
};
