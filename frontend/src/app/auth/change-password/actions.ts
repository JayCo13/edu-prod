"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/database";

const schema = z.object({
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
    .max(72, "Mật khẩu quá dài"),
});

/**
 * Change-password server action used by the teacher onboarding flow.
 *
 * Enforces the 24h window stamped into `user_metadata` by createTenantTeacher:
 * if `must_change_password === true` and `password_change_deadline` has
 * passed, the change is refused — the admin must reset the password manually.
 */
export async function changePasswordAction(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: "Bạn cần đăng nhập trước." };
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const mustChange = meta.must_change_password === true;
  const deadlineRaw = meta.password_change_deadline;
  const deadline =
    typeof deadlineRaw === "string" ? new Date(deadlineRaw) : null;

  if (mustChange && deadline && deadline.getTime() < Date.now()) {
    return {
      success: false,
      error:
        "Đã quá 24 giờ để đổi mật khẩu lần đầu. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
    };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Clear the first-login flag so future changes aren't subject to the
  // 24h window. Use the admin client because updateUser() cannot mutate
  // user_metadata in the same call as a password update.
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        must_change_password: false,
        password_change_deadline: null,
      },
    });
  } catch {
    // Non-fatal — the password is changed; the flag will be cleared on
    // their next successful change.
  }

  return { success: true };
}
