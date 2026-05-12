"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { requestPasswordReset, type AuthResult } from "@/app/actions/auth";

/**
 * Forgot Password Page
 * ====================
 * Context-aware: detects root domain vs subdomain for adaptive branding.
 * Always returns success message to prevent email enumeration.
 */

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await requestPasswordReset(formData);
      setResult(res);
    });
  }

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
            <Mail className="h-6 w-6 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quên mật khẩu?
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Nhập email của bạn, chúng tôi sẽ gửi link khôi phục mật khẩu.
          </p>
        </div>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {result?.error && (
            <motion.div
              key="error"
              className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <XCircle className="h-4 w-4 shrink-0" />
              {result.error}
            </motion.div>
          )}
          {result?.success && (
            <motion.div
              key="success"
              className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {result.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form
          action={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-100 bg-white p-7 shadow-sm"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                disabled={result?.success === true}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:opacity-60"
              />
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isPending || result?.success === true}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={isPending ? {} : { scale: 0.98 }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang gửi...
              </>
            ) : result?.success ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Đã gửi
              </>
            ) : (
              "Gửi link khôi phục"
            )}
          </motion.button>
        </form>

        {/* Back to login */}
        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Đăng nhập
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
