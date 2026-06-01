// Auto-gen mã học sinh "HS-NNNNNN".
//
// Cách làm: query MAX(student_code) đang theo prefix "HS-" cho tenant
// rồi +1. Không dùng PG sequence vì:
//   • Mỗi tenant cần dải số riêng.
//   • Admin có thể nhập mã thủ công xen kẽ (vd "HS-2026-001"); sequence
//     dễ va.
//
// Race condition: 2 admin tạo cùng lúc → có thể trùng. UNIQUE constraint
// catch + caller retry. Trong thực tế CENTER hiếm khi 2 admin tạo HS
// đồng thời, OK chấp nhận.

import type { SupabaseClient } from "@supabase/supabase-js";

const STUDENT_CODE_PREFIX = "HS-";
const STUDENT_CODE_PAD = 6; // HS-000001

export async function nextStudentCode(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string> {
  // Lấy code lớn nhất khớp format "HS-<digits>". Bỏ qua admin tự nhập
  // không theo format (vd "HS-2026-001").
  const { data } = await supabase
    .from("students")
    .select("student_code")
    .eq("tenant_id", tenantId)
    .like("student_code", `${STUDENT_CODE_PREFIX}%`)
    .order("student_code", { ascending: false })
    .limit(50);

  let maxNum = 0;
  for (const row of (data ?? []) as Array<{ student_code: string }>) {
    const rest = row.student_code.slice(STUDENT_CODE_PREFIX.length);
    if (/^\d+$/.test(rest)) {
      const n = parseInt(rest, 10);
      if (n > maxNum) maxNum = n;
    }
  }

  const next = (maxNum + 1).toString().padStart(STUDENT_CODE_PAD, "0");
  return `${STUDENT_CODE_PREFIX}${next}`;
}

// Validate khi admin nhập tay. Cho phép ASCII alphanumeric + dash, ≤ 30 chars.
export function validateStudentCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Mã HS không được để trống";
  if (trimmed.length > 30) return "Mã HS dài tối đa 30 ký tự";
  if (!/^[A-Za-z0-9-_./]+$/.test(trimmed)) {
    return "Mã HS chỉ chứa chữ, số, dấu - _ . /";
  }
  return null;
}
