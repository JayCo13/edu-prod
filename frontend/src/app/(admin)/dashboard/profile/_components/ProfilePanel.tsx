"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  Mail,
  Save,
  User as UserIcon,
} from "lucide-react";

import type { ProfileRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile } from "@/app/actions/profile";

interface Props {
  userId: string;
  email: string;
  initialProfile: ProfileRow | null;
}

const STORAGE_BUCKET = "public_assets";

function publicUrl(path: string): string {
  // Same as supabase.storage.from(bucket).getPublicUrl(path) but we don't
  // need a client instance for a public bucket — the URL is deterministic.
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

export default function ProfilePanel({ userId, email, initialProfile }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    initialProfile?.display_name ?? "",
  );
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(
    initialProfile?.avatar_url ?? "",
  );
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarUpload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4 MB).");
      return;
    }
    const supabase = createClient();
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setAvatarUrl(publicUrl(path));
      toast.success("Đã tải ảnh đại diện.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Tên hiển thị không được để trống.");
      return;
    }
    setPending(true);
    try {
      const r = await updateMyProfile({
        display_name: displayName.trim(),
        avatar_url: avatarUrl || null,
        bio: bio.trim(),
      });
      if (r.success) {
        toast.success("Đã cập nhật hồ sơ.");
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
          Thông tin cá nhân
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-slate-900">
          Hồ sơ của bạn
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Tên này xuất hiện trên lịch dạy, bảng lương, và email gửi từ
          trung tâm.
        </p>
      </header>

      <div className="space-y-4 px-5 py-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Ảnh đại diện"
              className="h-20 w-20 flex-shrink-0 rounded-2xl border border-slate-100 object-cover"
            />
          ) : (
            <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-2xl font-bold text-white">
              {(displayName || email || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              <Camera className="h-3.5 w-3.5" />
              {uploading
                ? "Đang tải..."
                : avatarUrl
                  ? "Đổi ảnh"
                  : "Tải ảnh lên"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="w-fit text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                Bỏ ảnh
              </button>
            )}
            <p className="text-[11px] leading-snug text-slate-400">
              PNG / JPG / WebP, tối đa 4 MB.
            </p>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <UserIcon className="h-3.5 w-3.5" />
            Tên hiển thị *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="Cô Hà"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Mail className="h-3.5 w-3.5" />
            Email
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              (không đổi được)
            </span>
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Giới thiệu ngắn</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              (tuỳ chọn)
            </span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ví dụ: GV IELTS Speaking, 8 năm kinh nghiệm tại trung tâm."
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <p className="mt-1 text-right font-mono text-[10px] uppercase tracking-wide text-slate-400">
            {bio.length}/500
          </p>
        </div>
      </div>

      <footer className="flex items-center justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu thay đổi
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
