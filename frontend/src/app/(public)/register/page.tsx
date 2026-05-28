import type { Metadata } from "next";
import RegisterForm from "@/components/auth/register-form";

/**
 * Register Page — Owner-only.
 *
 * After signup → confirmation email → /auth/confirm → /dashboard → (no
 * tenant detected) → /onboarding (kind picker: CENTER vs SCHOOL).
 *
 * Teacher self-signup remains out of scope (PRD §3.5). Teachers are
 * created by an existing center admin via /dashboard/teachers, which
 * delivers credentials by email.
 */

export const metadata: Metadata = {
  title: "Đăng ký",
  description:
    "Tạo tài khoản quản trị cho trung tâm dạy thêm hoặc trường học của bạn.",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />

      <div className="relative z-10 w-full max-w-5xl">
        <RegisterForm />
      </div>
    </div>
  );
}
