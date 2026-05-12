import { notFound } from "next/navigation";
import { getTeacherBySlug } from "@/app/actions/public";
import AdaptiveRegisterForm from "@/components/auth/adaptive-register-form";

/**
 * Tenant Register Page
 * ====================
 * Accessed via: thaynam.ticoclass.com/register
 * Rewritten to: /t/thaynam/register (internal)
 *
 * Fetches tenant info and passes to AdaptiveRegisterForm
 * for branded student registration.
 */

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TenantRegisterPage({ params }: PageProps) {
  const { slug } = await params;

  const result = await getTeacherBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const tenant = result.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,_#f1f5f9_1px,_transparent_1px),_linear-gradient(to_bottom,_#f1f5f9_1px,_transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="relative z-10">
        <AdaptiveRegisterForm
          tenantName={tenant.owner?.display_name || tenant.name}
          tenantLogo={tenant.logo_url || null}
        />
      </div>
    </div>
  );
}
