import Link from "next/link";
import { AlertTriangle, Clock, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ChangePasswordForm from "./_components/ChangePasswordForm";

/**
 * Teacher first-login password change.
 *
 * Reached from the credentials email sent in createTenantTeacher. Reads the
 * 24h deadline from user_metadata; if it has passed, this page renders a
 * locked state instead of the form. Once the teacher successfully changes
 * the password, the must_change_password flag is cleared so subsequent
 * changes are unrestricted.
 */
export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const mustChange = meta.must_change_password === true;
  const deadlineRaw = meta.password_change_deadline;
  const deadline =
    typeof deadlineRaw === "string" ? new Date(deadlineRaw) : null;
  const isExpired =
    mustChange && deadline ? deadline.getTime() < Date.now() : false;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Đặt mật khẩu mới cho tài khoản của bạn.
        </p>

        <div className="mt-6">
          {!user ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                <LogIn className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Bạn cần đăng nhập bằng email và mật khẩu tạm trước khi đổi
                  mật khẩu.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Đến trang đăng nhập
              </Link>
            </div>
          ) : isExpired ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Đã quá thời hạn 24 giờ.</p>
                  <p className="mt-1">
                    Bạn không thể tự đổi mật khẩu lần đầu nữa. Vui lòng liên hệ
                    quản trị viên trung tâm để được hỗ trợ.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {mustChange && deadline && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Vui lòng đổi mật khẩu trước{" "}
                    <strong>
                      {deadline.toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </strong>
                    . Sau thời gian này bạn sẽ phải nhờ quản trị viên hỗ trợ.
                  </p>
                </div>
              )}
              <ChangePasswordForm />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
