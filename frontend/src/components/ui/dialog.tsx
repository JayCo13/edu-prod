"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";

/**
 * Dialog (Modal)
 * ==============
 * Lightweight Shadcn-style dialog built on Radix UI.
 * Includes Framer Motion enter/exit animations.
 *
 * Usage:
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>...</DialogTitle>
 *       </DialogHeader>
 *       ...
 *     </DialogContent>
 *   </Dialog>
 */

// ── Root ───────────────────────────────────────────────────────────────────

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// ── Overlay ────────────────────────────────────────────────────────────────

const Overlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>((props, ref) => (
  <DialogPrimitive.Overlay ref={ref} {...props} asChild>
    <motion.div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    />
  </DialogPrimitive.Overlay>
));
Overlay.displayName = "DialogOverlay";

// ── Content ────────────────────────────────────────────────────────────────

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    children: ReactNode;
  }
>(({ children, ...props }, ref) => (
  <AnimatePresence>
    <DialogPrimitive.Portal>
      <Overlay />

      <DialogPrimitive.Content ref={ref} {...props} asChild>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-xl sm:p-8"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" as const }}
          >
            {children}

            {/* Close button */}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
              <span className="sr-only">Đóng</span>
            </DialogPrimitive.Close>
          </motion.div>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </AnimatePresence>
));
DialogContent.displayName = "DialogContent";

// ── Header / Title / Description ───────────────────────────────────────────

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-6 space-y-1.5">{children}</div>;
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`text-lg font-semibold tracking-tight text-slate-900 ${className || ""}`}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`text-sm text-slate-500 ${className || ""}`}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
