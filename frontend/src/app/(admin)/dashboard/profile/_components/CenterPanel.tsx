"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Camera,
  Loader2,
  MapPin,
  Phone,
  Save,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { updateMyCenter } from "@/app/actions/profile";

interface Props {
  tenantId: string;
  initial: {
    name: string;
    logo_url: string;
    description: string;
    address: string;
    phone: string;
  };
}

const STORAGE_BUCKET = "public_assets";

function publicUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

export default function CenterPanel({ tenantId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [description, setDescription] = useState(initial.description);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleLogoUpload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4 MB).");
      return;
    }
    const supabase = createClient();
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `center-logos/${tenantId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setLogoUrl(publicUrl(path));
      toast.success("Đã tải logo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Tên trung tâm không được để trống.");
      return;
    }
    setPending(true);
    try {
      const r = await updateMyCenter({
        name: name.trim(),
        logo_url: logoUrl,
        description: description.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      if (r.success) {
        toast.success("Đã cập nhật thông tin trung tâm.");
        router.refresh();
      } else {
        toast.error(r.error || "Không lưu được.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          Trung tâm
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-slate-900">
          Bộ mặt trung tâm
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Logo + thông tin liên hệ hiển thị trên bảng lương xuất Excel, email
          tự động, và (sắp tới) trang công khai của trung tâm.
        </p>
      </header>

      <div className="space-y-4 px-5 py-5">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo trung tâm"
              className="h-20 w-20 flex-shrink-0 rounded-2xl border border-slate-100 object-contain bg-slate-50"
            />
          ) : (
            <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-300">
              <Building2 className="h-7 w-7" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              <Camera className="h-3.5 w-3.5" />
              {uploading ? "Đang tải..." : logoUrl ? "Đổi logo" : "Tải logo lên"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="w-fit text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                Bỏ logo
              </button>
            )}
            <p className="text-[11px] leading-snug text-slate-400">
              PNG / JPG / WebP / SVG, tối đa 4 MB. Nền trong suốt được khuyên dùng.
            </p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Building2 className="h-3.5 w-3.5" />
            Tên trung tâm *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Ví dụ: Trung tâm Anh ngữ Chìa Khoá Vàng"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Address + Phone (compact 2-column) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Địa chỉ
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
              placeholder="123 Nguyễn Huệ, Q.1, TP.HCM"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Phone className="h-3.5 w-3.5" />
              Số điện thoại
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="0901 234 567"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Mô tả trung tâm</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              {description.length}/2000
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Giới thiệu về trung tâm: định hướng, khoá học chính, đội ngũ giáo viên…"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <footer className="flex items-center justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu thông tin trung tâm
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
