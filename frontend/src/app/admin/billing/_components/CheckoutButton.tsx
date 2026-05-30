"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { createPaymentLink } from "@/modules/billing/actions";

// Chỉ những gói tính phí thật mới có nút thanh toán. EARLY_ACCESS miễn
// phí nên không xuất hiện trên CheckoutButton.
type PayablePlan = "GROWTH" | "CUSTOM";

interface Props {
  plan: PayablePlan;
  label?: string;
  disabled?: boolean;
}

/**
 * Nút "Thanh toán ngay" — gọi createPaymentLink Server Action, nhận
 * checkoutUrl rồi `window.location.assign` sang PayOS.
 *
 * disabled khi tenant chưa khai báo billing_info — Server Action sẽ
 * trả lỗi tương ứng và CheckoutButton hiện thông báo.
 */
export default function CheckoutButton({
  plan,
  label = "Thanh toán ngay",
  disabled,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createPaymentLink({ plan });
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.assign(result.data.checkoutUrl);
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || disabled}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo link…
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}
    </div>
  );
}
