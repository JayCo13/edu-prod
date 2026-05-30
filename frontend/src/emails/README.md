# Email templates — Supabase Auth

Mọi template HTML trong thư mục này KHÔNG được code app gửi đi.
Chúng là **bản gốc** để paste thủ công vào Supabase Dashboard
(các email mà chính Supabase gửi: confirm signup, reset password,
magic link, invite, change email).

Transactional email do app gửi (mời giáo viên, thông báo chi lương…)
đi qua nodemailer với template inline trong
`frontend/src/lib/email/sender.ts` — không liên quan đến đây.

## Setup một lần (Supabase Dashboard)

### 1. Đổi sender từ "Supabase Auth" → "Edura"

`Project Settings → Authentication → SMTP Settings → Enable Custom SMTP`

Điền giống y `frontend/.env.local`:

| Field | Value |
|---|---|
| Sender email | `taicopgm@gmail.com` (hoặc SMTP_USER bạn dùng) |
| Sender name | `Edura` |
| Host | `smtp.gmail.com` |
| Port number | `587` |
| Username | giống Sender email |
| Password | 16-char Gmail App Password |
| Minimum interval | `60s` (tránh rate-limit Gmail) |

Bấm **Save**. Email confirm sẽ từ `Edura <taicopgm@gmail.com>` thay
vì `Supabase Auth <noreply@mail.app.supabase.io>`.

### 2. Site URL + Redirect URLs

`Authentication → URL Configuration`

- **Site URL**: URL production, ví dụ `https://edura.vn` hoặc
  `https://<site>.netlify.app`. Đây là phần đầu của
  `{{ .ConfirmationURL }}` trong email — đặt sai = link confirm
  trỏ về localhost.
- **Redirect URLs (allow-list)**: thêm cả dev + prod:
  ```
  http://localhost:3000/**
  https://edura.vn/**
  https://<your-site>.netlify.app/**
  ```

### 3. Paste templates

`Authentication → Email Templates`

Mở từng tab, paste HTML tương ứng:

| Supabase tab | File |
|---|---|
| Confirm signup | `confirm-email.html` |
| Reset Password | `reset-password.html` |
| Magic Link | `magic-link.html` |
| Invite User | `invite.html` |
| Change Email Address | `change-email.html` |

**Quan trọng**: trước khi paste, **thay `<SITE_URL>` bằng URL thật**
trong src của thẻ `<img>` (Supabase KHÔNG tự thay placeholder này).
Ví dụ:
```
src="<SITE_URL>/edura-logo.png"
→
src="https://edura.vn/edura-logo.png"
```

### 4. Test

Tạo tài khoản dummy → kiểm tra:
- Sender: `Edura <your.account@gmail.com>` ✓
- Logo hiển thị (không X đỏ) ✓
- Link confirm trỏ về production URL, không phải localhost ✓
