import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập vào Edura để quản lý khóa học của bạn.",
};

/**
 * Login Page
 * ==========
 * Server Component wrapper for the LoginForm client component.
 * Minimal centered layout with subtle background pattern.
 *
 * Suspense boundary is needed because LoginForm uses useSearchParams().
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      {/* Subtle grid background */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />

      <div className="relative z-10">
        <Suspense fallback={<div className="h-96 w-80" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
