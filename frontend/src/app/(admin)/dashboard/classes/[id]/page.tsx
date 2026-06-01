import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentTenantContext } from "@/lib/tenant-context-server";

import ClassDetailClient from "./_components/ClassDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClassDetailPage({ params }: Props) {
  const ctx = await getCurrentTenantContext().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!ctx.isAdmin) redirect("/dashboard");
  if (ctx.tenant.kind !== "CENTER") redirect("/dashboard");

  const { id } = await params;
  const { data: cls } = await ctx.supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  if (!cls) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/classes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Quay lại danh sách lớp
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{cls.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {cls.grade_level ? `Khối ${cls.grade_level}` : "Không phân khối"}
          {cls.year_label && ` · ${cls.year_label}`}
        </p>
      </div>
      <ClassDetailClient classId={cls.id} className={cls.name} />
    </div>
  );
}
