import type { Metadata } from "next";

import HeroSection from "@/components/landing/hero-section";
import SocialProof from "@/components/landing/social-proof";
import BentoGrid from "@/components/landing/bento-grid";
import HowItWorks from "@/components/landing/how-it-works";
import Pricing from "@/components/landing/pricing";
import Testimonial from "@/components/landing/testimonial";
import FAQ from "@/components/landing/faq";
import CTASection from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "VLearning — Bệ phóng cho sự nghiệp giảng dạy",
  description:
    "Tạo website khóa học mang tên miền của riêng bạn, bán video VOD bảo mật, tổ chức lớp live qua Zoom — VLearning lo phần kỹ thuật, bạn chỉ cần dạy.",
  openGraph: {
    title: "VLearning — Bệ phóng cho sự nghiệp giảng dạy",
    description:
      "Nền tảng SaaS White-label EdTech dành cho giáo viên độc lập. Tạo, thương hiệu hóa và bán khóa học dưới tên miền riêng.",
  },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SocialProof />
      <BentoGrid />
      <HowItWorks />
      <Pricing />
      <Testimonial />
      <FAQ />
      <CTASection />
    </>
  );
}
