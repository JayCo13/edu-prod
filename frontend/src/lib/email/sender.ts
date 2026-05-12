/**
 * White-label Email Sender (Resend)
 * ==================================
 * Utility for sending branded emails per tenant.
 *
 * Each tenant's emails include their own name and logo,
 * creating a white-label experience for students.
 *
 * ── INTEGRATION GUIDE ──────────────────────────────────────
 *
 * 1. SIGNUP CONFIRMATION EMAIL:
 *    After successful signUp in `actions/auth.ts`, call:
 *    ```
 *    await sendWhiteLabelEmail({
 *      to: email,
 *      subject: `Xác nhận tài khoản - ${tenantName}`,
 *      tenantName,
 *      tenantLogo: tenant.logo_url,
 *      htmlContent: confirmationTemplate(confirmUrl),
 *    });
 *    ```
 *    NOTE: This replaces Supabase's default confirmation email.
 *    You must disable Supabase's built-in confirmation email
 *    in Dashboard → Auth → Email Templates → set Confirm signup to disabled,
 *    then handle confirmation manually via your own SMTP.
 *
 * 2. PASSWORD RESET EMAIL:
 *    In `requestPasswordReset()`, after calling resetPasswordForEmail():
 *    ```
 *    await sendWhiteLabelEmail({
 *      to: email,
 *      subject: `Khôi phục mật khẩu - ${tenantName}`,
 *      tenantName,
 *      tenantLogo: tenant.logo_url,
 *      htmlContent: passwordResetTemplate(resetUrl),
 *    });
 *    ```
 *    NOTE: Similar to above — disable Supabase's default reset email.
 *
 * 3. WELCOME EMAIL (after onboarding):
 *    In `createTenantOnboarding()`, after tenant creation:
 *    ```
 *    await sendWhiteLabelEmail({
 *      to: teacherEmail,
 *      subject: "Chào mừng đến VLearning!",
 *      tenantName: "VLearning",
 *      tenantLogo: PLATFORM_LOGO_URL,
 *      htmlContent: welcomeTemplate(tenantName, subdomainUrl),
 *    });
 *    ```
 *
 * ── SETUP STEPS ────────────────────────────────────────────
 *
 * 1. Sign up at https://resend.com and get an API key
 * 2. Add to .env.local: RESEND_API_KEY=re_xxxxxxxxxx
 * 3. Verify your sending domain in Resend dashboard
 * 4. Update SENDER_EMAIL below with your verified address
 * ──────────────────────────────────────────────────────────
 */

// ── Config ─────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || "noreply@ticoclass.com";
const RESEND_API_URL = "https://api.resend.com/emails";

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

  // Guard: API key required
  if (!RESEND_API_KEY) {
    console.warn(
      "[Email] RESEND_API_KEY not configured. Skipping email send.",
      { to, subject },
    );
    return {
      success: false,
      error: "Email service not configured (RESEND_API_KEY missing).",
    };
  }

  // Build branded HTML
  const html = wrapInBrandedTemplate({ tenantName, tenantLogo, htmlContent });

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${tenantName} <${SENDER_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Email] Resend API error:", response.status, errorBody);
      return {
        success: false,
        error: `Email send failed (${response.status}).`,
      };
    }

    const data = (await response.json()) as { id: string };

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err) {
    console.error("[Email] Network error:", err);
    return {
      success: false,
      error: "Failed to connect to email service.",
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
