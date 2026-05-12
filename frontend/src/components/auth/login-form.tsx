"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

import { signIn, signInWithGoogle, type AuthResult } from "@/app/actions/auth";
import {
  GoogleIcon,
  Spinner,
  AuthDivider,
  AuthMessage,
} from "@/components/auth/auth-ui";

/**
 * LoginForm
 * =========
 * Client component with:
 *   - Google OAuth button (brand-compliant)
 *   - Email/Password form
 *   - Loading states with spinner
 *   - Animated error/success messages
 *   - Show/hide password toggle
 */

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("message") || null,
  );

  // Show success if redirected from email confirmation
  const confirmed = searchParams.get("confirmed") === "true";

  function handleEmailSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result: AuthResult = await signIn(formData);
      if (result?.error) {
        setError(result.error);
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

  return (
    <motion.div
      className="w-full max-w-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white"
        >
          V
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Chào mừng trở lại
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Đăng nhập để quản lý khóa học của bạn
        </p>
      </div>

      {/* ── Messages ───────────────────────────────────────── */}
      {confirmed && (
        <AuthMessage
          message="Email đã xác nhận thành công! Bạn có thể đăng nhập."
          type="success"
        />
      )}
      <AuthMessage message={error} type="error" />

      <div className={confirmed || error ? "mt-4" : ""}>
        {/* ── Google OAuth ───────────────────────────────────── */}
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

        {/* ── Divider ────────────────────────────────────────── */}
        <AuthDivider />

        {/* ── Email Form ─────────────────────────────────────── */}
        <form action={handleEmailSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
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
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="text-xs font-medium text-slate-600"
              >
                Mật khẩu
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
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
                Đang đăng nhập...
              </>
            ) : (
              "Đăng nhập"
            )}
          </motion.button>
        </form>

        {/* ── Footer ─────────────────────────────────────────── */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
          >
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
