import type { Metadata } from "next";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";
import { getCenterById } from "@/modules/centers/service";
import SettingsForm from "@/modules/centers/components/SettingsForm";

export const metadata: Metadata = {
  title: "Cấu hình trung tâm — Edura",
};

/**
 * /admin/settings — Center Settings page.
 *
 * Server Component. Authorization in two stages:
 *   1. The /admin/* layout already gated for an active center membership.
 *   2. We resolve the active center here and check role — CENTER_ADMIN
 *      can edit; CENTER_STAFF / TEACHER see read-only.
 *
 * The page never 403s outright: read access is allowed for any member of
 * the center per PRD §5.2 (settings are not secret). The form gates the
 * write button on `canEdit`.
 */
export default async function CenterSettingsPage() {
  const resolved = await resolveCenterId();

  if (!resolved.ok) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {resolved.message}
        </div>
      </div>
    );
  }

  const centerResult = await getCenterById(resolved.centerId);
  if (!centerResult.success) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {centerResult.error}
        </div>
      </div>
    );
  }

  const canEdit = resolved.role === "CENTER_ADMIN";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Cấu hình
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Cấu hình trung tâm
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Cập nhật thông tin nhận diện, múi giờ và mặc định vận hành của trung
          tâm. Thay đổi áp dụng cho toàn bộ tài khoản nhân viên.
        </p>
      </header>

      <SettingsForm center={centerResult.data} canEdit={canEdit} />
    </div>
  );
}
