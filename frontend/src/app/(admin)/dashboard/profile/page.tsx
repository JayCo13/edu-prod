import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ProfileRow, TenantRow } from "@/types/database";
import ProfilePanel from "./_components/ProfilePanel";
import CenterPanel from "./_components/CenterPanel";

/**
 * /dashboard/profile — personal profile + (if admin) center identity.
 *
 * Layout:
 *   - Left: profile (everyone)  — name, avatar, bio, email read-only
 *   - Right: center (admin only) — name, logo, address, phone, description
 *
 * Admin client used for the reads because the legacy `profiles` and
 * `tenants` RLS surfaces are fiddly; the page already authenticates the
 * caller and scopes by their user.id / tenant.id.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Center context: only fetch if the caller is an admin (owner OR slot
  // with is_admin). Non-admin teachers see only the profile panel.
  const ctx = await getCurrentTenantContext().catch(() => null);
  const isAdmin = ctx?.isAdmin ?? false;
  let tenantRow: TenantRow | null = null;
  if (isAdmin && ctx) {
    const { data } = await admin
      .from("tenants")
      .select("*")
      .eq("id", ctx.tenant.id)
      .maybeSingle();
    tenantRow = (data ?? null) as TenantRow | null;
  }

  // Also pull centers.address + centers.phone (only on the new schema).
  let centerExtras: { address: string; phone: string } = {
    address: "",
    phone: "",
  };
  if (isAdmin && ctx) {
    const { data: center } = await admin
      .from("centers")
      .select("address, phone")
      .eq("id", ctx.tenant.id)
      .maybeSingle();
    if (center) {
      centerExtras = {
        address: center.address ?? "",
        phone: center.phone ?? "",
      };
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Hồ sơ
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Hồ sơ &amp; cài đặt
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Quản lý thông tin cá nhân
          {isAdmin ? " và bộ mặt trung tâm" : ""}.
        </p>
      </header>

      {/* Two-column when admin (profile + center). Single centered column
          when teacher (just profile) — otherwise ProfilePanel sits awkwardly
          in the left half of a wide screen with empty space on the right. */}
      {isAdmin && tenantRow ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfilePanel
            userId={user.id}
            email={user.email ?? ""}
            initialProfile={(profileRow ?? null) as ProfileRow | null}
          />
          <CenterPanel
            tenantId={tenantRow.id}
            initial={{
              name: tenantRow.name,
              logo_url: tenantRow.logo_url ?? "",
              description: tenantRow.description ?? "",
              address: centerExtras.address,
              phone: centerExtras.phone,
            }}
          />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <ProfilePanel
            userId={user.id}
            email={user.email ?? ""}
            initialProfile={(profileRow ?? null) as ProfileRow | null}
          />
        </div>
      )}
    </div>
  );
}
