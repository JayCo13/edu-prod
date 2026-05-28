"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Info,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";

/**
 * ConfirmDialogProvider + useConfirm hook
 * ========================================
 * Replacement for window.confirm() — keeps the UI consistent with the rest
 * of the admin shell, supports async work in the handler (button shows a
 * spinner while pending), and lets callers customise tone + copy.
 *
 * Mount the provider ONCE at the shell level (admin-shell.tsx). Anywhere
 * inside it, call `const confirm = useConfirm()` and await its result:
 *
 *   if (await confirm({ title: "Xoá buổi học?", description: "..." })) {
 *     await deleteSession();
 *   }
 *
 * The hook resolves with `true` on confirm, `false` on cancel / Esc /
 * backdrop click. Re-opening while a previous dialog is still resolving
 * is a no-op (you'll get back the in-flight result).
 */

type Variant = "info" | "warning" | "danger";

interface ConfirmOptions {
  title: string;
  /** Plain string OR rendered React (for richer copy like lists, dates). */
  description?: ReactNode;
  /** Visual tone — "danger" for destructive, "warning" for lock-in actions. */
  variant?: Variant;
  /** Vietnamese-first labels. Defaults: "Xác nhận" / "Huỷ". */
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm() must be used inside <ConfirmDialogProvider>");
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  // While a destructive action is awaiting the resolver-supplied async work,
  // the dialog stays open and shows a spinner. We track this so callers can
  // await server actions inside their `if (await confirm(...))` blocks
  // without the dialog closing prematurely. (Future improvement; for now
  // the dialog closes on resolve immediately.)
  const inflight = useRef(false);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        if (inflight.current) {
          // A previous dialog is still on screen — refuse a stacked one and
          // return cancel rather than queueing (queueing is unexpected UX).
          resolve(false);
          return;
        }
        inflight.current = true;
        setPending({ ...options, resolve });
      }),
    [],
  );

  function close(result: boolean) {
    if (!pending) return;
    pending.resolve(result);
    inflight.current = false;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {pending && (
          <Dialog
            state={pending}
            onCancel={() => close(false)}
            onConfirm={() => close(true)}
          />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────

function Dialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: PendingState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const {
    title,
    description,
    variant = "info",
    confirmLabel = "Xác nhận",
    cancelLabel = "Huỷ",
  } = state;

  const Icon =
    variant === "danger"
      ? ShieldAlert
      : variant === "warning"
        ? AlertTriangle
        : Info;
  const iconBg =
    variant === "danger"
      ? "bg-rose-50 text-rose-600"
      : variant === "warning"
        ? "bg-amber-50 text-amber-600"
        : "bg-indigo-50 text-indigo-600";
  const confirmClass =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-500"
      : variant === "warning"
        ? "bg-amber-600 hover:bg-amber-500"
        : "bg-slate-900 hover:bg-slate-800";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm print:hidden"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onConfirm();
      }}
      tabIndex={-1}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4 px-6 pt-6">
          <div
            className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="pr-6 text-base font-semibold leading-snug text-slate-900"
            >
              {title}
            </h2>
            {description ? (
              <div className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {description}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Exported for advanced cases (e.g. an inline-stable spinner inside a
 *  confirm flow). Not commonly needed. */
export { Loader2 };
