"use server";

import nodemailer from "nodemailer";
import { z } from "zod";

/**
 * Feedback Server Action
 * =======================
 * Receives the landing-page feedback form and sends an email to the
 * project owner via the same Gmail SMTP setup the app uses for
 * transactional mail.
 *
 * Recipient address is read from `FEEDBACK_TO_EMAIL` env var so the
 * inbox can change without redeploy. Has a hardcoded fallback for
 * local dev — that fallback only lives inside this server-side file
 * and is never bundled to the browser ("use server" + the imports
 * keep this file in the server graph only).
 */

const FEEDBACK_TO =
  process.env.FEEDBACK_TO_EMAIL?.trim() || "taicopgm@gmail.com";

const schema = z.object({
  name: z
    .string({ message: "Vui lòng nhập tên." })
    .trim()
    .min(1, "Vui lòng nhập tên.")
    .max(100, "Tên quá dài (tối đa 100 ký tự)."),
  fromEmail: z
    .string({ message: "Vui lòng nhập email." })
    .trim()
    .email("Email không hợp lệ.")
    .max(200, "Email quá dài."),
  subject: z
    .string({ message: "Vui lòng nhập chủ đề." })
    .trim()
    .min(1, "Vui lòng nhập chủ đề.")
    .max(200, "Chủ đề quá dài (tối đa 200 ký tự)."),
  message: z
    .string({ message: "Vui lòng nhập nội dung." })
    .trim()
    .min(5, "Nội dung quá ngắn (tối thiểu 5 ký tự).")
    .max(5000, "Nội dung quá dài (tối đa 5000 ký tự)."),
});

export interface SendFeedbackResult {
  success: boolean;
  error?: string;
}

export async function sendFeedback(
  _prev: SendFeedbackResult | null,
  formData: FormData,
): Promise<SendFeedbackResult> {
  // ── Anti-spam ─────────────────────────────────────────────────────────
  //
  // Honeypot: trường ẩn `website` mắt người không thấy, không tab vào.
  // Bot fill mọi input → có giá trị → giả vờ thành công, không gửi mail.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    return { success: true };
  }

  // Time check: form phải mở ít nhất 1500ms trước khi submit. Bot
  // thường submit gần như tức thì.
  const renderedAt = Number(formData.get("t"));
  if (Number.isFinite(renderedAt) && Date.now() - renderedAt < 1500) {
    return {
      success: false,
      error: "Vui lòng đợi một chút rồi gửi lại.",
    };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    fromEmail: formData.get("fromEmail"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message ?? "Form không hợp lệ." };
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    return {
      success: false,
      error: "Hệ thống email chưa được cấu hình. Vui lòng thử lại sau.",
    };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const { name, fromEmail, subject, message } = parsed.data;
  try {
    await transporter.sendMail({
      from: `Edura Feedback <${user}>`,
      to: FEEDBACK_TO,
      replyTo: `${name} <${fromEmail}>`,
      subject: `[Edura] ${subject}`,
      text: [
        `Từ: ${name} <${fromEmail}>`,
        ``,
        message,
        ``,
        `── Gửi từ form góp ý trên trang chủ Edura.`,
      ].join("\n"),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#0f172a;line-height:1.6;">
          <p style="margin:0 0 12px;color:#64748b;font-size:12px;">
            Góp ý mới từ trang chủ Edura
          </p>
          <p style="margin:0 0 8px;"><strong>Từ:</strong> ${escapeHtml(name)} &lt;${escapeHtml(fromEmail)}&gt;</p>
          <p style="margin:0 0 16px;"><strong>Chủ đề:</strong> ${escapeHtml(subject)}</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:12px;white-space:pre-wrap;">${escapeHtml(message)}</div>
        </div>
      `.trim(),
    });
    return { success: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Lỗi không xác định";
    return { success: false, error: `Không gửi được email: ${detail}` };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
