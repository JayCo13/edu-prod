import type { Metadata } from "next";

import HeroSection from "@/components/landing/hero-section";
import BentoGrid from "@/components/landing/bento-grid";
import HowItWorks from "@/components/landing/how-it-works";
import Pricing from "@/components/landing/pricing";
import FAQ from "@/components/landing/faq";
import CTASection from "@/components/landing/cta-section";
// SocialProof + Testimonial bị tắt cho đến khi có số liệu / quote thật từ
// trung tâm. File vẫn nằm trong components/landing/ — import lại khi cần.

export const metadata: Metadata = {
  title: "VLearning — Quản lý trung tâm và trường học",
  description:
    "Một nền tảng cho trung tâm dạy thêm (tính lương theo buổi, xuất Excel) và trường học (xếp thời khoá biểu cả khối trong một bảng). Đang trong giai đoạn dùng thử.",
  openGraph: {
    title: "VLearning — Quản lý trung tâm và trường học",
    description:
      "Bảng lương cho trung tâm · Thời khoá biểu cho trường học · Quản lý giáo viên cho cả hai. Tiếng Việt, xuất Excel.",
  },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <BentoGrid />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTASection />
    </>
  );
}
