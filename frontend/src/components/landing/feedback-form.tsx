"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";

import { sendFeedback } from "@/app/actions/feedback";
import { ACCENT } from "./_accent";

/**
 * Feedback form rendered inside the landing CTA section.
 *
 * Submits via the `sendFeedback` Server Action — recipient inbox lives
 * server-side (FEEDBACK_TO_EMAIL env) and never reaches the client.
 *
 * Anti-spam: a visually-hidden "website" honeypot field (bots fill in
 * every input; humans never see this one) + a `t` timestamp that lets
 * the server reject submissions that arrive less than 1.5s after the
 * form rendered.
 */
export default function FeedbackForm() {
  const A = ACCENT;
  const [state, action, pending] = useActionState(sendFeedback, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Capture render time once — stays stable across re-renders. Used
  // server-side as the time-check baseline.
  const [renderedAt] = useState<number>(() => Date.now());

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  if (state?.success) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center"
        style={{ boxShadow: `0 12px 30px -10px ${A.shadow}` }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-6 w-6 text-emerald-700" strokeWidth={2.5} />
        </div>
        <h3 className="mt-3 font-display text-[17px] font-bold text-slate-900">
          Đã nhận được góp ý của bạn.
        </h3>
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-slate-600">
          Cảm ơn bạn rất nhiều. Chúng tôi đọc từng email và sẽ phản hồi nếu
          cần làm rõ thêm.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
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
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5"
      style={{
        boxShadow: `0 12px 30px -10px ${A.shadow}, 0 0 0 1px ${A.tint}`,
      }}
    >
      {/* Honeypot — không hiển thị cho người dùng (sr-only + tabIndex
          âm + autocomplete off). Bot scrape form sẽ điền vào và bị
          server bỏ qua âm thầm. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        style={{ position: "absolute", left: "-9999px" }}
      >
        <label htmlFor="fb-website">Website (để trống)</label>
        <input
          id="fb-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <input type="hidden" name="t" value={String(renderedAt)} />

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

      <div className="mt-3 space-y-2">
        {/* Name + email gộp một hàng trên màn ≥ sm, xếp dọc trên mobile. */}
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>

        <Field>
          <Label htmlFor="fb-subject">Chủ đề</Label>
          <Input
            id="fb-subject"
            name="subject"
            required
            maxLength={200}
            placeholder="Vd: Góp ý về xếp thời khoá biểu"
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
            rows={3}
            placeholder="Càng cụ thể càng giúp được nhiều — chuyện gì xảy ra, bạn mong nó nên ra sao."
            disabled={pending}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>
      </div>

      {state?.error && (
        <p className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[12px] text-rose-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
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
