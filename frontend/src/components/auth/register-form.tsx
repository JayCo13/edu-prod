"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User2,
} from "lucide-react";

import {
  signUpMultiTenant,
  signInWithGoogle,
  type AuthResult,
} from "@/app/actions/auth";
import {
  AuthMessage,
  GoogleIcon,
  Spinner,
} from "@/components/auth/auth-ui";

/**
 * RegisterForm — owner-only signup (PRD §3.5 keeps teacher self-signup out).
 *
 * Layout: 2-column card on lg+ screens (left = brand + Google + teacher
 * notice, right = email form). Stacks to single column on mobile.
 *
 * Flow:
 *   1. signUpMultiTenant → confirmation email.
 *   2. User opens link → /auth/confirm → logs in → /dashboard.
 *   3. /dashboard sees no tenant → /onboarding (CENTER vs SCHOOL picker).
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
      } else if (result?.success) {
        setSuccess(
          result.message ||
            "Một email xác nhận đã được gửi. Vui lòng kiểm tra hộp thư.",
        );
      }
    });
  }

  function handleGoogleSignup() {
    setError(null);
    setSuccess(null);
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-slate-100"
    >
      {success ? (
        // Success replaces both columns with a single centered card.
        <div className="col-span-full p-8 sm:p-12">
          <SuccessCard message={success} />
        </div>
      ) : (
        <>
          {/* ── LEFT: brand + Google + teacher notice ───────────────────
              Quiet white-on-white layout — no loud gradient. Hidden on
              mobile (form below has its own brand mark). */}
          <div className="hidden flex-col gap-6 bg-slate-50/40 p-10 lg:flex">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">
                V
              </span>
              <span className="font-display">Edura</span>
            </Link>

            <div>
              <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-slate-900">
                Quản lý trung tâm —<br />
                đúng giờ, đúng số.
              </h2>
              <p className="mt-2.5 max-w-sm text-[13px] leading-relaxed text-slate-500">
                Bảng lương, lịch dạy, phân quyền giáo viên — gom về một chỗ.
              </p>
            </div>

            {/* Google signup — moved from right column per design feedback */}
            <motion.button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              whileHover={isLoading ? {} : { scale: 1.005 }}
              whileTap={isLoading ? {} : { scale: 0.99 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {isGooglePending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              Tiếp tục với Google
            </motion.button>

            {/* Teacher guardrail — sits below Google per design feedback */}
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                <span className="font-semibold">Bạn là giáo viên?</span> Vui
                lòng chờ{" "}
                <span className="font-semibold">lời mời từ trung tâm</span>{" "}
                — không cần tự đăng ký tại đây.
              </span>
            </div>
          </div>

          {/* ── RIGHT: Email form ───────────────────────────────────── */}
          <div className="flex flex-col justify-center p-6 sm:p-10">
            <div className="mb-5">
              {/* Mobile-only brand mark + the Google/teacher block since
                  the left column is hidden < lg. */}
              <div className="lg:hidden">
                <Link
                  href="/"
                  className="mb-4 inline-flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">
                    V
                  </span>
                  <span className="font-display">Edura</span>
                </Link>
              </div>

              <h1 className="font-display text-[22px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
                Tạo tài khoản quản trị
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                Đăng ký cho trung tâm hoặc trường của bạn.
              </p>
            </div>

            <AuthMessage message={error} type="error" />

            <div className={error ? "mt-3" : ""}>
              {/* Mobile fallback: Google + teacher notice here, since left
                  column is hidden under lg. */}
              <div className="space-y-3 lg:hidden">
                <motion.button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  whileHover={isLoading ? {} : { scale: 1.005 }}
                  whileTap={isLoading ? {} : { scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {isGooglePending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <GoogleIcon className="h-4 w-4" />
                  )}
                  Tiếp tục với Google
                </motion.button>

                <div
                  role="note"
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-900"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    <span className="font-semibold">Bạn là giáo viên?</span>{" "}
                    Vui lòng chờ{" "}
                    <span className="font-semibold">lời mời từ trung tâm</span>.
                  </span>
                </div>

                <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  Hoặc dùng email
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              </div>

              <form action={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="register-name"
                    className="mb-1.5 block text-xs font-medium text-slate-600"
                  >
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-name"
                      name="displayName"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

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
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

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
                      placeholder="Ít nhất 8 ký tự"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  whileTap={isLoading ? {} : { scale: 0.98 }}
                >
                  {isPending && !isGooglePending ? (
                    <>
                      <Spinner />
                      Đang tạo tài khoản...
                    </>
                  ) : (
                    <>
                      Tạo tài khoản
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                Bằng việc đăng ký, bạn đồng ý với{" "}
                <Link href="/#" className="underline hover:text-slate-600">
                  Điều khoản
                </Link>{" "}
                và{" "}
                <Link href="/#" className="underline hover:text-slate-600">
                  Chính sách bảo mật
                </Link>
                .
              </p>

              <p className="mt-4 text-center text-sm text-slate-500">
                Đã có tài khoản?{" "}
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Đăng nhập
                </Link>
              </p>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function SuccessCard({ message }: { message: string }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        Kiểm tra hộp thư của bạn
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
        {message}
      </p>
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
