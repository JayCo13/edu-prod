"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import {
  createTenantOnboarding,
  checkSubdomain,
} from "@/app/actions/onboarding";

/**
 * Onboarding Page
 * ===============
 * Mandatory step for teachers after signup.
 * Creates their tenant (school) with a custom subdomain.
 *
 * Features:
 *   - Auto-generate slug from tenant name
 *   - Real-time subdomain availability check (debounced)
 *   - Premium animated UI with success celebration
 */

// ── Slug Generator ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  // Form state
  const [tenantName, setTenantName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainEdited, setSubdomainEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subdomain availability
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Auto-generate subdomain from tenant name
  useEffect(() => {
    if (!subdomainEdited && tenantName) {
      setSubdomain(slugify(tenantName));
    }
  }, [tenantName, subdomainEdited]);

  // Debounced subdomain check
  const checkAvailability = useCallback(
    (slug: string) => {
      if (slug.length < 3) {
        setAvailable(null);
        return;
      }

      setChecking(true);
      const timer = setTimeout(async () => {
        const result = await checkSubdomain(slug);
        if (result.success && result.data) {
          setAvailable(result.data.available);
        }
        setChecking(false);
      }, 500);

      return () => clearTimeout(timer);
    },
    [],
  );

  useEffect(() => {
    const cleanup = checkAvailability(subdomain);
    return cleanup;
  }, [subdomain, checkAvailability]);

  // Handle subdomain input change
  function handleSubdomainChange(value: string) {
    // Only allow valid chars
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSubdomain(cleaned);
    setSubdomainEdited(true);
    setAvailable(null);
  }

  // Submit handler
  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTenantOnboarding(formData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setError(result.error || "Đã xảy ra lỗi.");
      }
    });
  }

  // ── Success State ──────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
        >
          <motion.div
            className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <Sparkles className="h-8 w-8 text-emerald-500" />
          </motion.div>

          <motion.h1
            className="text-3xl font-bold tracking-tight text-slate-900"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Học viện đã sẵn sàng!
          </motion.h1>

          <motion.p
            className="mt-3 text-base text-slate-500"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Đang chuyển bạn đến Dashboard...
          </motion.p>

          <motion.div
            className="mt-6"
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

  // ── Onboarding Form ────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      {/* Subtle grid bg */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />

      <motion.div
        className="relative z-10 w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        {/* Header */}
        <div className="mb-10 text-center">
          <motion.div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <GraduationCap className="h-7 w-7 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tạo học viện của bạn
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
            Chỉ vài bước nữa thôi. Đặt tên và chọn địa chỉ cho trường học trực
            tuyến của bạn.
          </p>
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form
          action={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm"
        >
          {/* Tenant Name */}
          <div>
            <label
              htmlFor="tenant_name"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Tên học viện
            </label>
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="tenant_name"
                name="tenant_name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder='Ví dụ: "Toán Thầy Nam"'
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Subdomain */}
          <div>
            <label
              htmlFor="subdomain"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Địa chỉ trường học
            </label>
            <div className="relative flex items-center">
              <Globe className="pointer-events-none absolute left-4 z-10 h-5 w-5 text-slate-400" />
              <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
                <span className="hidden select-none pl-12 text-sm text-slate-400 sm:block">
                  https://
                </span>
                <input
                  id="subdomain"
                  name="subdomain"
                  type="text"
                  required
                  minLength={3}
                  maxLength={63}
                  value={subdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  placeholder="toan-thay-nam"
                  className="min-w-0 flex-1 border-none bg-transparent py-3.5 pl-3 pr-1 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 sm:pl-1"
                />
                <span className="select-none pr-4 text-sm text-slate-400">
                  .ticoclass.com
                </span>
              </div>
            </div>

            {/* Availability indicator */}
            <div className="mt-2 h-5">
              <AnimatePresence mode="wait">
                {checking && subdomain.length >= 3 && (
                  <motion.div
                    key="checking"
                    className="flex items-center gap-1.5 text-xs text-slate-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Đang kiểm tra...
                  </motion.div>
                )}
                {!checking && available === true && subdomain.length >= 3 && (
                  <motion.div
                    key="available"
                    className="flex items-center gap-1.5 text-xs text-emerald-600"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tên miền này khả dụng!
                  </motion.div>
                )}
                {!checking && available === false && subdomain.length >= 3 && (
                  <motion.div
                    key="taken"
                    className="flex items-center gap-1.5 text-xs text-rose-600"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Tên miền đã được sử dụng
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Hidden full_name field */}
          <input type="hidden" name="full_name" value={tenantName} />

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={isPending || available === false || subdomain.length < 3}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={isPending ? {} : { scale: 0.98 }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo học viện...
              </>
            ) : (
              <>
                Tạo học viện
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Bạn có thể thay đổi thông tin này sau trong phần Cài đặt.
        </p>
      </motion.div>
    </div>
  );
}
