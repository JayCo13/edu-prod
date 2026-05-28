/**
 * White-label Email Sender (Gmail SMTP via nodemailer)
 * =====================================================
 * Utility for sending branded emails per tenant. Each tenant's emails
 * include their own name and logo for a white-label feel.
 *
 * ── SETUP STEPS (Gmail / Workspace) ────────────────────────
 *
 * 1. Turn on 2-Step Verification for the sending Google account
 *    (https://myaccount.google.com/security).
 * 2. Create an App Password at https://myaccount.google.com/apppasswords
 *    (pick "Mail" / "Other"). Google gives you a 16-character secret.
 * 3. Add these to .env.local:
 *      SMTP_HOST=smtp.gmail.com
 *      SMTP_PORT=587
 *      SMTP_USER=your.account@gmail.com
 *      SMTP_PASSWORD=<16-char app password, NO spaces>
 *      SMTP_FROM=your.account@gmail.com         # or "Name <addr@gmail.com>"
 * 4. Free Gmail caps at ~500 recipients/day; Workspace caps at ~2000.
 *    For higher volume, swap in a dedicated provider (Resend, SES).
 * ──────────────────────────────────────────────────────────
 */

import nodemailer, { type Transporter } from "nodemailer";

// ── Config ─────────────────────────────────────────────────────────────────

const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER ?? "";

// Cache the transporter — nodemailer reuses the underlying TCP connection
// across messages, which matters when an admin invites many teachers in
// a row.
let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!SMTP_USER || !SMTP_PASSWORD) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 465 → implicit TLS; 587 → STARTTLS (secure: false + upgrade).
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return transporter;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WhiteLabelEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Tenant name (displayed in email header) */
  tenantName: string;
  /** Tenant logo URL (displayed in email header, optional) */
  tenantLogo?: string | null;
  /** Full HTML content of the email body */
  htmlContent: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Email Wrapper Template ─────────────────────────────────────────────────

function wrapInBrandedTemplate({
  tenantName,
  tenantLogo,
  htmlContent,
}: Pick<WhiteLabelEmailParams, "tenantName" | "tenantLogo" | "htmlContent">): string {
  const logoHtml = tenantLogo
    ? `<img src="${tenantLogo}" alt="${tenantName}" style="max-height:48px;max-width:200px;margin-bottom:16px;" />`
    : `<div style="font-size:24px;font-weight:bold;color:#0f172a;margin-bottom:16px;">${tenantName}</div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      ${logoHtml}
    </div>

    <!-- Content Card -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 24px;">
      ${htmlContent}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;color:#94a3b8;font-size:12px;line-height:1.6;">
      <p>Email này được gửi bởi ${tenantName}</p>
      <p>Powered by <a href="https://ticoclass.com" style="color:#6366f1;text-decoration:none;">TicoClass</a></p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ── Main Send Function ─────────────────────────────────────────────────────

export async function sendWhiteLabelEmail(
  params: WhiteLabelEmailParams,
): Promise<EmailResult> {
  const { to, subject, tenantName, tenantLogo, htmlContent } = params;

  const t = getTransporter();
  if (!t) {
    console.warn(
      "[Email] SMTP not configured. Set SMTP_USER and SMTP_PASSWORD (App Password) in .env.local.",
      { to, subject },
    );
    return {
      success: false,
      error: "Email service not configured (SMTP_USER/SMTP_PASSWORD missing).",
    };
  }

  // Build branded HTML
  const html = wrapInBrandedTemplate({ tenantName, tenantLogo, htmlContent });

  // Gmail rewrites the From header to the authenticated SMTP_USER no matter
  // what we set, so the display name is the only thing under our control.
  // Including tenantName in the From makes it look like the email is coming
  // from the center.
  const from = SMTP_FROM.includes("<")
    ? SMTP_FROM
    : `${tenantName} <${SMTP_FROM}>`;

  try {
    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[Email] SMTP send failed:", err);
    const message =
      err instanceof Error ? err.message : "Unknown SMTP error";
    return {
      success: false,
      error: `Email send failed: ${message}`,
    };
  }
}

// ── Email Content Templates (Ready to use) ─────────────────────────────────

export function confirmationEmailContent(confirmUrl: string): string {
  return `
    <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Xác nhận tài khoản</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Cảm ơn bạn đã đăng ký. Nhấn nút bên dưới để xác nhận email của bạn.
    </p>
    <a href="${confirmUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
      Xác nhận email
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.
    </p>
  `;
}

export function passwordResetEmailContent(resetUrl: string): string {
  return `
    <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Khôi phục mật khẩu</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tạo mật khẩu mới.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
      Đặt mật khẩu mới
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      Link này sẽ hết hạn sau 24 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.
    </p>
  `;
}

/**
 * Email sent to a brand-new teacher whose account was created by a center
 * admin. Reveals the temporary password and asks the teacher to change it
 * within 24 hours — after that, the change-password page is locked.
 */
export function teacherCredentialsEmailContent(params: {
  displayName: string;
  loginEmail: string;
  tempPassword: string;
  changePasswordUrl: string;
  tenantName: string;
}): string {
  const { displayName, loginEmail, tempPassword, changePasswordUrl, tenantName } =
    params;
  return `
    <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Chào ${displayName},</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px;">
      ${tenantName} vừa tạo tài khoản giáo viên cho bạn. Dưới đây là thông tin
      đăng nhập tạm thời — hãy đổi mật khẩu trong vòng <strong>24 giờ</strong>.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:0 0 20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#0f172a;">
      <div style="margin-bottom:8px;"><span style="color:#94a3b8;">Email:</span> ${loginEmail}</div>
      <div><span style="color:#94a3b8;">Mật khẩu tạm:</span> <strong>${tempPassword}</strong></div>
    </div>
    <a href="${changePasswordUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
      Đăng nhập &amp; đổi mật khẩu
    </a>
    <p style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.6;margin-top:20px;">
      ⚠ Sau 24 giờ, bạn sẽ không thể tự đổi mật khẩu nữa và phải liên hệ
      quản trị viên trung tâm để được hỗ trợ.
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
      Nếu bạn không mong đợi email này, hãy bỏ qua nó.
    </p>
  `;
}

/** Email body sent when an admin marks a teacher as paid. Two variants:
 *  bank transfer (account-number receipt) vs cash (in-person confirmation).
 *  Vietnamese-first copy — the admin chose the method, the teacher reads. */
export function payoutPaidEmailContent(params: {
  displayName: string;
  tenantName: string;
  periodLabel: string; // e.g. "Tháng 05/2026"
  amountFormatted: string; // e.g. "4.200.000đ"
  method: "BANK_TRANSFER" | "CASH";
  /** Last 4 digits only, for bank-transfer template — never the full number. */
  accountTail?: string | null;
  bankName?: string | null;
  /** Optional note the admin typed on mark-paid. */
  adminNote?: string | null;
  dashboardUrl: string;
}): string {
  const {
    displayName,
    tenantName,
    periodLabel,
    amountFormatted,
    method,
    accountTail,
    bankName,
    adminNote,
    dashboardUrl,
  } = params;

  const bankBlock =
    method === "BANK_TRANSFER" && accountTail
      ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin:0 0 20px;font-size:13px;color:#0f172a;">
          <div style="color:#64748b;margin-bottom:6px;">Đã chuyển tới tài khoản</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            ${bankName ? `${bankName} · ` : ""}•••• ${accountTail}
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-top:8px;">
            Hãy kiểm tra app ngân hàng. Nếu sau 1 giờ chưa nhận được, vui lòng
            liên hệ quản trị viên trung tâm.
          </div>
        </div>
      `
      : "";

  const cashBlock =
    method === "CASH"
      ? `
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;margin:0 0 20px;font-size:13px;color:#92400e;">
          <strong>Hình thức: tiền mặt</strong>
          <div style="margin-top:6px;">
            Trung tâm đã trao tiền mặt cho bạn. Nếu bạn chưa nhận, vui lòng
            phản hồi email này hoặc liên hệ quản trị viên trung tâm.
          </div>
        </div>
      `
      : "";

  const noteBlock = adminNote?.trim()
    ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin:0 0 20px;font-size:13px;color:#334155;">
        <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Ghi chú từ trung tâm</div>
        ${adminNote.trim()}
      </div>
    `
    : "";

  return `
    <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Đã thanh toán lương ${periodLabel}</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Chào ${displayName}, ${tenantName} vừa hoàn tất chi lương ${periodLabel} cho bạn.
    </p>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
      <div style="color:#047857;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Thực lĩnh</div>
      <div style="font-size:26px;font-weight:700;color:#065f46;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
        ${amountFormatted}
      </div>
    </div>
    ${bankBlock}
    ${cashBlock}
    ${noteBlock}
    <a href="${dashboardUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
      Xem chi tiết
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
      Email này được hệ thống VLearning gửi tự động. Nếu có sai sót, vui lòng
      phản hồi trực tiếp cho quản trị viên trung tâm.
    </p>
  `;
}

export function welcomeEmailContent(
  tenantName: string,
  dashboardUrl: string,
): string {
  return `
    <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Chào mừng đến ${tenantName}! 🎉</h2>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Học viện của bạn đã sẵn sàng. Hãy bắt đầu tạo khóa học và mời học sinh tham gia.
    </p>
    <a href="${dashboardUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
      Vào Dashboard
    </a>
  `;
}
