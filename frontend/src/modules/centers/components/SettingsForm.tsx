"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCenterSettingsAction } from "@/modules/centers/actions";
import type { CenterRow } from "@/modules/centers/types";

/**
 * Center Settings Form — client component.
 *
 * Renders editable fields for a center. Calls updateCenterSettingsAction
 * (Server Action) on submit; server-side validation + RLS are the
 * authoritative checks — this form does only light UX-level validation.
 *
 * All copy in Vietnamese (CLAUDE.md §8.3). Date/currency formatting
 * helpers will be added when the page surfaces those fields.
 */

interface Props {
  center: CenterRow;
  /** TRUE iff the viewer is CENTER_ADMIN at this center. Read-only otherwise. */
  canEdit: boolean;
}

const INPUT_CLASS =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

function vndCurrencyLabel(currency: string): string {
  // PRD §7.2 currency convention is "1.000.000đ". Display the locked v1
  // value as đ; foreign currencies (none in v1) fall back to the code.
  return currency === "VND" ? "đ (VND)" : currency;
}

export default function SettingsForm({ center, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(center.name);
  const [address, setAddress] = useState(center.address);
  const [phone, setPhone] = useState(center.phone);
  const [timezone, setTimezone] = useState(center.timezone);
  const [businessHoursOpen, setBusinessHoursOpen] = useState(
    center.settings.business_hours?.open ?? "08:00",
  );
  const [businessHoursClose, setBusinessHoursClose] = useState(
    center.settings.business_hours?.close ?? "21:00",
  );
  const [defaultDuration, setDefaultDuration] = useState(
    center.settings.default_class_duration ?? 90,
  );

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canEdit) return;

    startTransition(async () => {
      const result = await updateCenterSettingsAction(center.id, {
        name,
        address,
        phone,
        timezone,
        settings: {
          business_hours: {
            open: businessHoursOpen,
            close: businessHoursClose,
          },
          default_class_duration: defaultDuration,
        },
      });

      if (result.success) {
        toast.success("Đã lưu cấu hình trung tâm.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Identity ───────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Thông tin trung tâm
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Hiển thị trên hóa đơn, email và website công khai.
          </p>
        </header>

        <Field label="Tên trung tâm" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || isPending}
            maxLength={200}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Địa chỉ">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEdit || isPending}
            maxLength={500}
            className={INPUT_CLASS}
            placeholder="VD: 12 Phan Đình Phùng, Q. Ba Đình, Hà Nội"
          />
        </Field>

        <Field label="Số điện thoại">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!canEdit || isPending}
            maxLength={40}
            className={INPUT_CLASS}
            placeholder="VD: 0901 234 567"
          />
        </Field>
      </section>

      {/* ── Locale + Operations ────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Cấu hình vận hành
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Múi giờ, giờ làm việc, thời lượng buổi học mặc định.
          </p>
        </header>

        <Field label="Múi giờ">
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canEdit || isPending}
            className={INPUT_CLASS}
            placeholder="Asia/Ho_Chi_Minh"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Giờ mở cửa">
            <input
              type="time"
              value={businessHoursOpen}
              onChange={(e) => setBusinessHoursOpen(e.target.value)}
              disabled={!canEdit || isPending}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Giờ đóng cửa">
            <input
              type="time"
              value={businessHoursClose}
              onChange={(e) => setBusinessHoursClose(e.target.value)}
              disabled={!canEdit || isPending}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Thời lượng buổi học mặc định (phút)">
          <input
            type="number"
            min={15}
            max={480}
            step={5}
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
            disabled={!canEdit || isPending}
            className={INPUT_CLASS}
          />
        </Field>
      </section>

      {/* ── Read-only metadata ─────────────────────────────────────── */}
      <section className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6">
        <p className="text-sm text-slate-500">
          Đơn vị tiền tệ:{" "}
          <span className="font-mono text-slate-700">
            {vndCurrencyLabel(center.currency)}
          </span>{" "}
          · Gói: <span className="font-mono text-slate-700">{center.subscription_plan}</span>{" "}
          · Trạng thái:{" "}
          <span className="font-mono text-slate-700">
            {center.subscription_status}
          </span>
        </p>
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chỉ quản trị viên trung tâm (CENTER_ADMIN) mới được cập nhật cấu hình.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
