"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  PartyPopper,
} from "lucide-react";

import { updatePassword, type AuthResult } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Welcome / Invite Setup Page
 * ============================
 * Destination after a teacher accepts an admin invite (the
 * /auth/setup route handler establishes the session, then redirects
 * here). The teacher picks their own password — same underlying action
 * as the password-reset flow, but with welcoming copy.
 */

export default function WelcomePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    // Pull the invited_display_name we stuffed into user_metadata when
    // the admin clicked "Add teacher". Falls back to email if missing.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        (user.user_metadata?.invited_display_name as string | undefined) ??
        (user.user_metadata?.display_name as string | undefined) ??
        user.email ??
        "";
      setDisplayName(name);
    });
  }, []);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await updatePassword(formData);
      setResult(res);
      if (res.success) {
        setTimeout(() => router.push("/dashboard"), 1800);
      }
    });
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (result?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
        >
          <motion.div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2,
            }}
          >
            <PartyPopper className="h-7 w-7 text-emerald-500" />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold text-slate-900"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            Sẵn sàng rồi!
          </motion.h1>
          <motion.p
            className="mt-2 text-sm text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            Đang đưa bạn vào trung tâm...
          </motion.p>
          <motion.div
            className="mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
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
            className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </motion.div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Chào mừng đến VLearning
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {displayName ? `Xin chào, ${displayName}` : "Đặt mật khẩu"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Bạn đã được mời tham gia trung tâm. Hãy đặt mật khẩu để bắt đầu.
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
          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Mật khẩu mới
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                tabIndex={-1}
                aria-label={
                  showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                }
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={isPending ? {} : { scale: 0.98 }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Bắt đầu
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
