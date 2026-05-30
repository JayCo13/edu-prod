"use client";

import { useActionState, useRef, useEffect } from "react";
import { Check, Loader2, Send } from "lucide-react";

import { sendFeedback } from "@/app/actions/feedback";
import { ACCENT } from "./_accent";

/**
 * Inline feedback form rendered inside the landing CTA section.
 *
 * Submits via the `sendFeedback` Server Action. The recipient inbox
 * lives entirely server-side (FEEDBACK_TO_EMAIL env var with a fallback
 * inside the "use server" file) — nothing about it leaks to the browser.
 */
export default function FeedbackForm() {
  const A = ACCENT;
  const [state, action, pending] = useActionState(sendFeedback, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Khi gửi thành công thì xoá form để người dùng có thể gửi tiếp nếu muốn.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  // Trạng thái "đã gửi xong" — hiển thị thông báo cảm ơn thay cho form.
  if (state?.success) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center"
        style={{ boxShadow: `0 12px 30px -10px ${A.shadow}` }}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-6 w-6 text-emerald-700" strokeWidth={2.5} />
        </div>
        <h3 className="mt-3 font-display text-[17px] font-bold text-slate-900">
          Đã nhận được góp ý của bạn.
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
          Cảm ơn bạn rất nhiều. Chúng tôi đọc từng email trong giờ hành chính
          và sẽ phản hồi nếu cần làm rõ thêm.
        </p>
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset();
            // Force re-render bằng cách reload form action state.
            window.location.hash = "feedback-form";
            window.location.reload();
          }}
          className="mt-4 text-[12.5px] font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-800 hover:underline"
        >
          Gửi góp ý khác
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      id="feedback-form"
      className="rounded-2xl border border-slate-200/80 bg-white p-5"
      style={{
        boxShadow: `0 12px 30px -10px ${A.shadow}, 0 0 0 1px ${A.tint}`,
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: A.solid }}
        >
          · Gửi góp ý
        </p>
        <span className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
          Trực tiếp trên web
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <Field>
          <Label htmlFor="fb-name">Tên của bạn</Label>
          <Input
            id="fb-name"
            name="name"
            required
            maxLength={100}
            placeholder="Nguyễn Văn A"
            disabled={pending}
          />
        </Field>

        <Field>
          <Label htmlFor="fb-email">Email</Label>
          <Input
            id="fb-email"
            name="fromEmail"
            type="email"
            required
            maxLength={200}
            placeholder="ban@example.com"
            disabled={pending}
          />
        </Field>

        <Field>
          <Label htmlFor="fb-subject">Chủ đề</Label>
          <Input
            id="fb-subject"
            name="subject"
            required
            maxLength={200}
            placeholder="Góp ý về tính năng…"
            disabled={pending}
          />
        </Field>

        <Field>
          <Label htmlFor="fb-message">Nội dung</Label>
          <textarea
            id="fb-message"
            name="message"
            required
            minLength={5}
            maxLength={5000}
            rows={4}
            placeholder="Mô tả ngắn gọn điều bạn muốn chia sẻ. Càng cụ thể càng giúp được nhiều."
            disabled={pending}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>
      </div>

      {state?.error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[12.5px] text-rose-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: A.solid,
          boxShadow: `0 6px 16px -4px ${A.shadow}`,
        }}
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang gửi…
          </>
        ) : (
          <>
            Gửi góp ý
            <Send className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      <p className="mt-3 text-center font-mono text-[10px] text-slate-400">
        Chúng tôi đọc email trong giờ hành chính (8h – 18h, T2 – T7).
      </p>
    </form>
  );
}

// ── Sub-primitives ──────────────────────────────────────────────────────────

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-mono text-[9.5px] font-medium uppercase tracking-wide text-slate-500"
    >
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}
