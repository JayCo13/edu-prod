import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMyPayoutMethods } from "@/app/actions/payout-methods";
import PayoutMethodsPanel from "./_components/PayoutMethodsPanel";

/**
 * /dashboard/payouts — teacher's bank info management.
 *
 * Manual-payout workflow: the teacher registers where they want to be paid;
 * the tenant admin reads that info on the payroll period detail and uses
 * their own banking app to transfer. After transfer, admin marks the item
 * "Đã thanh toán" and the teacher gets an email.
 *
 * Access: anyone with an active tenant_teachers slot in *any* tenant. We
 * resolve the slot directly (not via getCurrentTenantContext) because that
 * helper's "Path 1: owns tenant" branch will return currentTeacherId=null
 * for owners whose tenant doesn't have a backfilled slot — those owners
 * may still be teachers (in another tenant) or want to register a method
 * for themselves. Admin client bypasses the recursive RLS read on
 * tenant_teachers (fix from migration 0020) so a brand-new login works.
 */
export default async function PayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: slot } = await admin
    .from("tenant_teachers")
    .select("id, tenant_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!slot) {
    // User has no active teacher slot anywhere — they don't get paid via
    // this system. Bounce them back to the dashboard rather than render an
    // empty panel they can't act on.
    redirect("/dashboard");
  }

  const result = await listMyPayoutMethods();
  const methods = result.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Tài khoản nhận lương
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Nhận lương
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Thông tin chuyển khoản này chỉ được hiển thị cho quản trị viên trung
          tâm khi họ chi lương. Không hiển thị công khai và không lưu cho bất
          kỳ bên thứ ba nào.
        </p>
      </div>

      <PayoutMethodsPanel initialMethods={methods} />
    </div>
  );
}
