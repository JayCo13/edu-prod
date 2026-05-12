import type { Metadata } from "next";
import AdaptiveRegisterForm from "@/components/auth/adaptive-register-form";

export const metadata: Metadata = {
  title: "Đăng ký — Tạo học viện trực tuyến",
  description:
    "Tạo tài khoản VLearning miễn phí và bắt đầu xây dựng trường học trực tuyến của bạn.",
};

/**
 * Root Register Page
 * ==================
 * Root domain (ticoclass.com/register) → Teacher registration.
 * No tenantName prop → AdaptiveRegisterForm shows platform branding.
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="relative z-10">
        <AdaptiveRegisterForm />
      </div>
    </div>
  );
}
