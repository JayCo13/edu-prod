"use client";

import { Toaster } from "sonner";

/**
 * Toast Provider
 * ==============
 * Global toast notification container.
 * Uses 'sonner' for lightweight, animated toasts.
 * Include this once in a root layout.
 */
export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "0.75rem",
          fontSize: "0.875rem",
          border: "1px solid #e2e8f0",
        },
      }}
    />
  );
}
