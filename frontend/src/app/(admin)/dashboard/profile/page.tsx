import { createClient } from "@/lib/supabase/server";
import { getMyProfileLayout } from "@/app/actions/profile";
import { DEFAULT_LAYOUT } from "@/components/profile/_sample";
import { ProfileEditor } from "@/components/profile/editor/ProfileEditor";

export const metadata = {
  title: "Trang cá nhân",
};

export default async function ProfilePage() {
  // Try to load the saved layout; fall back to DEFAULT_LAYOUT.
  // Both Supabase-down and missing-column degrade gracefully.
  const result = await getMyProfileLayout();
  const initialLayout = result.success ? result.data : DEFAULT_LAYOUT;

  // Best-effort fetch of the tenant's subdomain for the editor chrome.
  let subdomain = "cohuong";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("tenants")
        .select("subdomain")
        .eq("owner_id", user.id)
        .single();
      if (data?.subdomain) subdomain = data.subdomain;
    }
  } catch {
    // Supabase unreachable — preview defaults are fine.
  }

  return <ProfileEditor initialLayout={initialLayout} subdomain={subdomain} />;
}
