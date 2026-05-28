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
  Wallet,
  CalendarDays,
  Check,
} from "lucide-react";

import {
  createTenantOnboarding,
  checkSubdomain,
} from "@/app/actions/onboarding";

import { ACCENT } from "@/components/landing/_accent";

type TenantKind = "CENTER" | "SCHOOL";

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

  // Step 1: pick product face. null = no choice yet → show picker screen.
  // CENTER = trung tâm dạy thêm (payroll-first). SCHOOL = tiện ích thời
  // khoá biểu cho trường học (TKB-first). Migration 0031 backs this.
  const [kind, setKind] = useState<TenantKind | null>(null);

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

  // ── Step 1: Product face picker ────────────────────────────────
  if (kind === null) {
    return <KindPicker onPick={setKind} />;
  }

  // ── Step 2: Onboarding Form ────────────────────────────────────
  const isSchool = kind === "SCHOOL";
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
            {isSchool ? "Tạo không gian trường học" : "Tạo trung tâm của bạn"}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
            {isSchool
              ? "Đặt tên trường + địa chỉ truy cập. Sau đó bạn vào ngay phần Thời khoá biểu để xếp lịch."
              : "Đặt tên trung tâm + địa chỉ truy cập. Sau đó bạn quản lý lịch dạy và bảng lương ở một chỗ."}
          </p>
          <button
            type="button"
            onClick={() => setKind(null)}
            className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-600"
          >
            ← Đổi loại tài khoản
          </button>
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
              {isSchool ? "Tên trường" : "Tên trung tâm"}
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
                placeholder={
                  isSchool
                    ? 'Ví dụ: "THCS Lê Quý Đôn"'
                    : 'Ví dụ: "Anh ngữ ABC"'
                }
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
              Địa chỉ truy cập
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
          {/* Product face — picked in step 1 (KindPicker above). */}
          <input type="hidden" name="kind" value={kind} />

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
                {isSchool ? "Đang tạo không gian trường..." : "Đang tạo trung tâm..."}
              </>
            ) : (
              <>
                {isSchool ? "Tạo không gian trường" : "Tạo trung tâm"}
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

// ── KindPicker ────────────────────────────────────────────────────────────
//
// Step 1 of onboarding. Asks the user whether they want the trung tâm
// (payroll-first) product face or the trường học (timetable-first) one.
// The choice is stored on `tenants.kind` (migration 0031) and drives nav
// filtering + copy across the app.

interface KindOption {
  kind: TenantKind;
  title: string;
  tagline: string;
  bullets: readonly string[];
  badge: string;
  icon: typeof Wallet;
  accent: string;
}

const KIND_OPTIONS: readonly KindOption[] = [
  {
    kind: "CENTER",
    title: "Trung tâm dạy thêm",
    tagline: "Quản lý lịch dạy, lương giáo viên, học phí ở một chỗ.",
    bullets: [
      "Tự động tính lương theo buổi / giờ / lương cứng",
      "Lịch dạy đa giáo viên · phát hiện trùng giờ",
      "Xuất Excel bảng lương cho kế toán",
      "Mời giáo viên qua email",
    ],
    badge: "Killer feature: Bảng lương",
    icon: Wallet,
    accent: ACCENT.solid,
  },
  {
    kind: "SCHOOL",
    title: "Tiện ích trường học",
    tagline: "Xếp thời khoá biểu Thứ × Tiết × Giáo viên cho trường chính quy.",
    bullets: [
      "Định nghĩa Lớp · Môn · Khung tiết",
      "Grid thời khoá biểu Mon–Sat trực quan",
      "In / xuất Excel TKB cho học sinh, phụ huynh",
      "Không có chức năng tính lương",
    ],
    badge: "Cho trường công, trường tư",
    icon: CalendarDays,
    accent: "#0891b2",
  },
];

function KindPicker({ onPick }: { onPick: (k: TenantKind) => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />

      <motion.div
        className="relative z-10 w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        <div className="mb-10 text-center">
          <motion.div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <Sparkles className="h-7 w-7 text-white" />
          </motion.div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bước 1 / 2
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bạn đăng ký cho loại tổ chức nào?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Tuỳ lựa chọn, giao diện và tính năng sẽ được điều chỉnh phù hợp.
            Có thể đổi sau trong Cài đặt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {KIND_OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.kind}
                type="button"
                onClick={() => onPick(opt.kind)}
                className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:-translate-y-1 hover:border-slate-300"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  boxShadow: `0 16px 40px -20px ${opt.accent}55`,
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: `${opt.accent}15`,
                    color: opt.accent,
                  }}
                >
                  {opt.badge}
                </span>

                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ background: opt.accent }}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {opt.title}
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    {opt.tagline}
                  </p>
                </div>

                <ul className="space-y-1.5 text-[13px] text-slate-700">
                  {opt.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                        style={{ background: `${opt.accent}20`, color: opt.accent }}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>

                <div
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform group-hover:translate-x-1"
                  style={{ color: opt.accent }}
                >
                  Chọn {opt.title.toLowerCase()}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Không chắc chọn gì? Phần lớn trung tâm dạy thêm bên ngoài giờ học
          chính khoá nên chọn <strong>Trung tâm dạy thêm</strong>.
        </p>
      </motion.div>
    </div>
  );
}
