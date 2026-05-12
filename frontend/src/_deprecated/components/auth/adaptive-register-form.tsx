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
 * AdaptiveRegisterForm
 * ====================
 * Context-aware registration form:
 *   - Root domain: branding = platform, role = teacher
 *   - Subdomain: branding = teacher's school, role = student
 *
 * Props:
 *   tenantName — if present, we're on a subdomain (student signup)
 *   tenantLogo — optional logo URL for branded header
 */

interface AdaptiveRegisterFormProps {
  tenantName?: string | null;
  tenantLogo?: string | null;
}

export default function AdaptiveRegisterForm({
  tenantName,
  tenantLogo,
}: AdaptiveRegisterFormProps) {
  const isSubdomain = !!tenantName;
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
      if (result?.error) setError(result.error);
      if (result?.success && result.message) setSuccess(result.message);
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

  // ── Success State ──────────────────────────────────────────────────────
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
        <p className="mt-6 text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-700"
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
      {/* Header — Adaptive Branding */}
      <div className="mb-8 text-center">
        {tenantLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenantLogo}
            alt={tenantName || ""}
            className="mx-auto mb-4 h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <Link
            href="/"
            className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white"
          >
            V
          </Link>
        )}

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          {isSubdomain
            ? `Đăng ký học cùng ${tenantName}`
            : "Bắt đầu học viện của bạn"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isSubdomain
            ? "Tạo tài khoản để truy cập khóa học"
            : "Tạo trường học trực tuyến với thương hiệu riêng"}
        </p>
      </div>

      {/* Error */}
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
          {isGooglePending ? <Spinner className="h-4 w-4" /> : <GoogleIcon className="h-4 w-4" />}
          Continue with Google
        </motion.button>

        <AuthDivider />

        {/* Email Form */}
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="mb-1.5 block text-xs font-medium text-slate-600">
              Họ và tên
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-name"
                name="displayName"
                type="text"
                required
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-slate-600">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-slate-600">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-password"
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
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

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
              isSubdomain ? "Đăng ký học" : "Tạo học viện"
            )}
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Đăng nhập
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
