"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";

import { updatePassword, type AuthResult } from "@/app/actions/auth";

/**
 * Update Password Page
 * ====================
 * Shown after user clicks the password reset email link.
 * The auth/update-password route handler establishes the session first,
 * then redirects here.
 */

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await updatePassword(formData);
      setResult(res);
      if (res.success) {
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    });
  }

  // ── Success State ────────────────────────────────────────────
  if (result?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <ShieldCheck className="h-7 w-7 text-emerald-500" />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold text-slate-900"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {result.message}
          </motion.h1>
          <motion.p
            className="mt-2 text-sm text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Đang chuyển bạn đến Dashboard...
          </motion.p>
          <motion.div
            className="mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <Lock className="h-6 w-6 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Đặt mật khẩu mới
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Nhập mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {result?.error && (
            <motion.div
              className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <XCircle className="h-4 w-4 shrink-0" />
              {result.error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form
          action={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white p-7 shadow-sm"
        >
          {/* New Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Mật khẩu mới
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Tối thiểu 8 ký tự"
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                placeholder="Nhập lại mật khẩu"
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={isPending ? {} : { scale: 0.98 }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang cập nhật...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Cập nhật mật khẩu
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
