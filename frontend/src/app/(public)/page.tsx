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
  title: "VLearning — Phần mềm quản lý trung tâm giáo dục",
  description:
    "Một chỗ quản lịch dạy, điểm danh, và tính lương giáo viên cho trung tâm. Đang trong giai đoạn early access.",
  openGraph: {
    title: "VLearning — Phần mềm quản lý trung tâm giáo dục",
    description:
      "Bảng lương + lịch dạy + quản lý giáo viên cho trung tâm Việt Nam. Trả theo số giáo viên active.",
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
