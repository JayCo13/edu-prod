"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";

import { saveBillingInfo } from "@/modules/billing/actions";
import type { BillType, BillingInfoRow } from "@/modules/billing/types";

interface Props {
  initial: BillingInfoRow | null;
}

/**
 * Form khai báo thông tin xuất hoá đơn của trung tâm / trường học.
 * Toggle ORG / INDIVIDUAL — ORG yêu cầu MST + tên công ty, INDIVIDUAL
 * chỉ cần tên + email người nhận.
 */
export default function BillingInfoForm({ initial }: Props) {
  const [state, action, pending] = useActionState(saveBillingInfo, null);

  // Theo dõi lựa chọn ORG / INDIVIDUAL trực tiếp trong state để ẩn /
  // hiện khu vực "Thông tin tổ chức". Mặc định ORG nếu chưa có dữ liệu.
  const [billType, setBillType] = useState<BillType>(
    initial?.bill_type ?? "ORG",
  );

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">
          Loại hoá đơn
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Chọn theo nhu cầu xuất hoá đơn của trung tâm / trường bạn.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <BillTypeRadio
            value="ORG"
            checked={billType === "ORG"}
            onChange={setBillType}
            label="Tổ chức (có MST)"
            desc="Xuất hoá đơn cho trung tâm / trường — dùng để khấu trừ chi phí."
          />
          <BillTypeRadio
            value="INDIVIDUAL"
            checked={billType === "INDIVIDUAL"}
            onChange={setBillType}
            label="Cá nhân"
            desc="Đơn giản hơn — không cần MST. Không khấu trừ chi phí được."
          />
        </div>
      </div>

      {/* ORG-only fields. Chỉ render khi chọn ORG. Khi chuyển sang
          INDIVIDUAL, server tự xoá company_name + tax_code lúc upsert
          nên dữ liệu cũ không bị mắc kẹt. */}
      {billType === "ORG" && (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-base font-bold text-slate-900">
          Thông tin tổ chức
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Bắt buộc nếu xuất hoá đơn cho tổ chức.
        </p>

        <div className="mt-4 grid gap-3">
          <Field>
            <Label htmlFor="bf-company">Tên công ty / trường</Label>
            <Input
              id="bf-company"
              name="company_name"
              defaultValue={initial?.company_name ?? ""}
              placeholder="Trung tâm Anh ngữ ABC / Trường THCS XYZ"
              maxLength={200}
            />
          </Field>
          <Field>
            <Label htmlFor="bf-mst">Mã số thuế (MST)</Label>
            <Input
              id="bf-mst"
              name="tax_code"
              defaultValue={initial?.tax_code ?? ""}
              placeholder="0123456789 hoặc 0123456789-001"
              maxLength={20}
            />
          </Field>
          <Field>
            <Label htmlFor="bf-address">Địa chỉ</Label>
            <Input
              id="bf-address"
              name="address"
              defaultValue={initial?.address ?? ""}
              placeholder="123 Đường XYZ, Quận 1, TP.HCM"
              maxLength={500}
            />
          </Field>
        </div>
      </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">
          Người nhận hoá đơn
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Email này nhận file PDF hoá đơn từ sInvoice sau mỗi giao dịch.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="bf-rname">Họ tên</Label>
            <Input
              id="bf-rname"
              name="recipient_name"
              required
              defaultValue={initial?.recipient_name ?? ""}
              placeholder="Nguyễn Văn A"
              maxLength={200}
            />
          </Field>
          <Field>
            <Label htmlFor="bf-remail">Email</Label>
            <Input
              id="bf-remail"
              name="recipient_email"
              type="email"
              required
              defaultValue={initial?.recipient_email ?? ""}
              placeholder="ketoan@example.com"
              maxLength={200}
            />
          </Field>
          <Field>
            <Label htmlFor="bf-rphone">Điện thoại (tuỳ chọn)</Label>
            <Input
              id="bf-rphone"
              name="recipient_phone"
              defaultValue={initial?.recipient_phone ?? ""}
              placeholder="0901 234 567"
              maxLength={20}
            />
          </Field>
        </div>
      </div>

      {state && !state.success && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-800">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Đã lưu thông tin xuất hoá đơn.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu…
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Lưu thông tin
          </>
        )}
      </button>
    </form>
  );
}

// ── Sub-primitives ──────────────────────────────────────────────────────────

function BillTypeRadio({
  value,
  checked,
  onChange,
  label,
  desc,
}: {
  value: BillType;
  checked: boolean;
  onChange: (v: BillType) => void;
  label: string;
  desc: string;
}) {
  return (
    <label className="group cursor-pointer">
      <input
        type="radio"
        name="bill_type"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors peer-checked:border-indigo-500 peer-checked:bg-indigo-50/60 peer-checked:ring-1 peer-checked:ring-indigo-500">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      </div>
    </label>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
    />
  );
}
