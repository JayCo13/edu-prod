"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

export type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? object : { data: T }))
  | { success: false; error: string };

function err(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
  return { success: false, error: msg };
}

export interface SessionTeacherRow {
  session_id: string;
  teacher_id: string;
  pay_share_pct: number;
}

const inputSchema = z
  .object({
    session_id: z.string().uuid(),
    teachers: z
      .array(
        z.object({
          teacher_id: z.string().uuid(),
          pay_share_pct: z.number().int().min(0).max(100),
        }),
      )
      .min(1, "Cần ít nhất 1 giáo viên.")
      .max(10),
  })
  .refine(
    (d) => {
      const sum = d.teachers.reduce((s, t) => s + t.pay_share_pct, 0);
      return sum === 100;
    },
    {
      message: "Tổng tỷ lệ chia lương phải = 100%.",
      path: ["teachers"],
    },
  )
  .refine(
    (d) => {
      const ids = d.teachers.map((t) => t.teacher_id);
      return new Set(ids).size === ids.length;
    },
    {
      message: "Không được chọn cùng 1 giáo viên 2 lần.",
      path: ["teachers"],
    },
  );

export async function getSessionTeachers(
  sessionId: string,
): Promise<ActionResult<SessionTeacherRow[]>> {
  try {
    const { supabase, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên xem được." };
    }
    const { data, error } = await supabase
      .from("session_teachers")
      .select("session_id,teacher_id,pay_share_pct")
      .eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as SessionTeacherRow[] };
  } catch (e) {
    return err(e);
  }
}

export async function setSessionTeachers(
  input: z.infer<typeof inputSchema>,
): Promise<ActionResult> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Form không hợp lệ." };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên cấu hình được co-teaching." };
    }

    // Verify session thuộc tenant.
    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, tenant_id")
      .eq("id", parsed.data.session_id)
      .maybeSingle();
    if (!session || session.tenant_id !== tenant.id) {
      return { success: false, error: "Buổi học không tồn tại." };
    }

    // Replace toàn bộ trong 1 transaction-ish flow: delete cũ, insert mới.
    // Không có atomic batch trong Supabase JS — chấp nhận risk nhỏ
    // (rất hiếm vì admin chỉ sửa 1 session 1 lần).
    const { error: delErr } = await supabase
      .from("session_teachers")
      .delete()
      .eq("session_id", parsed.data.session_id);
    if (delErr) return { success: false, error: delErr.message };

    if (parsed.data.teachers.length === 1 && parsed.data.teachers[0].pay_share_pct === 100) {
      // Solo session — không cần lưu vào session_teachers (engine fallback).
      revalidatePath("/dashboard/calendar");
      return { success: true };
    }

    const rows = parsed.data.teachers.map((t) => ({
      session_id: parsed.data.session_id,
      teacher_id: t.teacher_id,
      pay_share_pct: t.pay_share_pct,
    }));
    const { error: insErr } = await supabase.from("session_teachers").insert(rows);
    if (insErr) return { success: false, error: insErr.message };

    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

export async function clearSessionTeachers(
  sessionId: string,
): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return { success: false, error: "Chỉ quản trị viên." };
    }
    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, tenant_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session || session.tenant_id !== tenant.id) {
      return { success: false, error: "Buổi học không tồn tại." };
    }
    const { error } = await supabase
      .from("session_teachers")
      .delete()
      .eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (e) {
    return err(e);
  }
}
