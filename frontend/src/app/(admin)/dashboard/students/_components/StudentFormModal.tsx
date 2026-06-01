"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { StudentInput } from "@/modules/students/actions";
import type { StudentGender, StudentRow } from "@/modules/students/types";

interface Props {
  initial: StudentRow | null;
  onSubmit: (input: StudentInput) => void;
  onClose: () => void;
  pending: boolean;
}

export default function StudentFormModal({ initial, onSubmit, onClose, pending }: Props) {
  const [code, setCode] = useState(initial?.student_code ?? "");
  const [name, setName] = useState(initial?.display_name ?? "");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [gender, setGender] = useState<StudentGender | "">(initial?.gender ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [parentName, setParentName] = useState(initial?.parent_name ?? "");
  const [parentPhone, setParentPhone] = useState(initial?.parent_phone ?? "");
  const [parentEmail, setParentEmail] = useState(initial?.parent_email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">
            {initial ? `Sửa: ${initial.display_name}` : "Thêm học sinh"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              student_code: code.trim() || undefined,
              display_name: name.trim(),
              dob: dob || null,
              gender: (gender || null) as StudentGender | null,
              phone: phone.trim() || null,
              parent_name: parentName.trim() || null,
              parent_phone: parentPhone.trim() || null,
              parent_email: parentEmail.trim() || null,
              address: address.trim() || null,
              note: note.trim() || null,
              is_active: active,
            });
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Field>
              <Label>Mã HS (trống = tự sinh)</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="HS-000001"
              />
            </Field>
            <Field>
              <Label>Họ và tên *</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Field>
              <Label>Ngày sinh</Label>
              <Input
                type="date"
                value={dob ?? ""}
                onChange={(e) => setDob(e.target.value)}
              />
            </Field>
            <Field>
              <Label>Giới tính</Label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as StudentGender | "")}
                className={inputCls}
              >
                <option value="">—</option>
                <option value="M">Nam</option>
                <option value="F">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
            <Field>
              <Label>SĐT học sinh</Label>
              <Input
                value={phone ?? ""}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0901 234 567"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phụ huynh
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field>
                <Label>Họ tên phụ huynh</Label>
                <Input value={parentName ?? ""} onChange={(e) => setParentName(e.target.value)} />
              </Field>
              <Field>
                <Label>SĐT phụ huynh</Label>
                <Input
                  value={parentPhone ?? ""}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="0901 234 567"
                />
              </Field>
            </div>
            <Field>
              <Label>Email phụ huynh</Label>
              <Input
                type="email"
                value={parentEmail ?? ""}
                onChange={(e) => setParentEmail(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <Label>Địa chỉ</Label>
            <Input value={address ?? ""} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <Field>
            <Label>Ghi chú</Label>
            <textarea
              value={note ?? ""}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>

          {initial && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              Đang theo học (bỏ check = ngưng kích hoạt)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400";

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}
