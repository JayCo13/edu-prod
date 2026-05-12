"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";

import { signUpMultiTenant, signInWithGoogle, type AuthResult } from "@/app/actions/auth";
import {
  GoogleIcon,
  Spinner,
  AuthDivider,
  AuthMessage,
} from "@/components/auth/auth-ui";

/**
 * RegisterForm
 * ============
 * Client component with:
 *   - Google OAuth button
 *   - Email/Password/Name registration form
 *   - Loading states
 *   - Success state: shows email confirmation message with animation
 *   - Password visibility toggle
 */

export default function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result: AuthResult = await signUpMultiTenant(formData);
      if (result?.error) {
        setError(result.error);
      }
      if (result?.success && result.message) {
        setSuccess(result.message);
      }
    });
  }

  function handleGoogleLogin() {
    setError(null);
    setIsGooglePending(true);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result?.error) {
        setError(result.error);
        setIsGooglePending(false);
      }
    });
  }

  const isLoading = isPending || isGooglePending;

  // ── Success State (Email Sent) ─────────────────────────────────────────
  if (success) {
    return (
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        <motion.div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </motion.div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Kiểm tra hộp thư của bạn
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
          {success}
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">
            Không nhận được email? Kiểm tra thư mục <strong>Spam</strong> hoặc{" "}
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setError(null);
              }}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              thử lại
            </button>
          </p>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Đăng nhập
          </Link>
        </p>
      </motion.div>
    );
  }

  // ── Registration Form ──────────────────────────────────────────────────
  return (
    <motion.div
      className="w-full max-w-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white"
        >
          V
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Tạo tài khoản mới
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Bắt đầu xây dựng khóa học của bạn miễn phí
        </p>
      </div>

      {/* Error Message */}
      <AuthMessage message={error} type="error" />

      <div className={error ? "mt-4" : ""}>
        {/* Google OAuth */}
        <motion.button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          whileHover={isLoading ? {} : { scale: 1.01 }}
          whileTap={isLoading ? {} : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {isGooglePending ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
          Continue with Google
        </motion.button>

        <AuthDivider />

        {/* Email Form */}
        <form action={handleSubmit} className="space-y-4">
          {/* Display Name */}
          <div>
            <label
              htmlFor="register-name"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Họ và tên
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-name"
                name="displayName"
                type="text"
                required
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="register-password"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            whileTap={isLoading ? {} : { scale: 0.98 }}
          >
            {isPending && !isGooglePending ? (
              <>
                <Spinner />
                Đang tạo tài khoản...
              </>
            ) : (
              "Đăng ký"
            )}
          </motion.button>

          {/* Terms */}
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Bằng việc đăng ký, bạn đồng ý với{" "}
            <Link href="/terms" className="underline hover:text-slate-600">
              Điều khoản Dịch vụ
            </Link>{" "}
            và{" "}
            <Link href="/privacy" className="underline hover:text-slate-600">
              Chính sách Bảo mật
            </Link>
          </p>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
