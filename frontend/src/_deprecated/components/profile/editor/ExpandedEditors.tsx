"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bold,
  Check,
  CreditCard,
  Italic,
  Layout,
  Link2,
  List,
  Minus,
  Quote,
  Type,
} from "lucide-react";
import { ABOUT_CHAR_CAP } from "../_constants";
import { DragHandle } from "./_dnd";
import type {
  HeroModuleT,
  AboutModuleT,
  FeaturedModuleT,
  ContactModuleT,
} from "@/lib/profile-schema";
import { SAMPLE_COURSES } from "../_sample";

interface ShellProps {
  step: string;
  title: string;
  icon: ReactNode;
  onCollapse?: () => void;
  children: ReactNode;
}

function ExpandedShell({ step, title, icon, onCollapse, children }: ShellProps) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.18)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
        <DragHandle />
        <span
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{
            background: "var(--profile-accent-tint)",
            color: "var(--profile-accent)",
          }}
        >
          {icon}
        </span>
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
            {step}
          </p>
          <p className="text-[13.5px] font-semibold text-slate-900">{title}</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
          aria-label="Thu gọn"
        >
          ▴
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-slate-400";

// ── Hero ───────────────────────────────────────────────────────────────────

interface HeroExpandedProps {
  module: HeroModuleT;
  onChange: (next: HeroModuleT) => void;
  onCollapse?: () => void;
}

export function HeroExpanded({ module, onChange, onCollapse }: HeroExpandedProps) {
  const c = module.content;
  const set = (patch: Partial<typeof c>) =>
    onChange({ ...module, content: { ...c, ...patch } });
  const setVariant = (variant: "centered" | "split") =>
    onChange({ ...module, variant });

  return (
    <ExpandedShell
      step="01 · BẮT BUỘC"
      title="Hero · Giới thiệu cá nhân"
      icon={<Layout className="h-4 w-4" />}
      onCollapse={onCollapse}
    >
      <div>
        <FieldLabel>Kiểu bố cục</FieldLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(
            [
              { id: "centered" as const, label: "Centered" },
              { id: "split" as const, label: "Split" },
            ]
          ).map((opt) => {
            const on = module.variant === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVariant(opt.id)}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  on
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div
                  className={`relative h-10 w-12 overflow-hidden rounded-md border ${
                    on ? "border-slate-300" : "border-slate-200"
                  } bg-white`}
                >
                  {opt.id === "centered" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <span className="h-1 w-6 rounded-full bg-slate-300" />
                      <span className="h-0.5 w-4 rounded-full bg-slate-200" />
                    </div>
                  ) : (
                    <div className="flex h-full items-center gap-1 px-1">
                      <span className="h-7 w-3.5 rounded bg-slate-300" />
                      <span className="flex flex-col gap-0.5">
                        <span className="h-1 w-5 rounded-full bg-slate-300" />
                        <span className="h-0.5 w-4 rounded-full bg-slate-200" />
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[12.5px] font-medium text-slate-800">
                  {opt.label}
                </span>
                {on && (
                  <span
                    className="ml-auto"
                    style={{ color: "var(--profile-accent)" }}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Họ và tên</FieldLabel>
          <input
            value={c.name}
            onChange={(e) => set({ name: e.target.value })}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <FieldLabel>Vai trò</FieldLabel>
          <input
            value={c.role}
            onChange={(e) => set({ role: e.target.value })}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      </div>
      <div>
        <FieldLabel>Tagline</FieldLabel>
        <input
          value={c.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
          className={`mt-1.5 ${inputCls}`}
        />
      </div>
      <div>
        <FieldLabel>CTA chính</FieldLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <input
            value={c.primaryCtaLabel}
            onChange={(e) => set({ primaryCtaLabel: e.target.value })}
            className={inputCls}
          />
          <input
            value={c.primaryCtaHref}
            onChange={(e) => set({ primaryCtaHref: e.target.value })}
            className={`${inputCls} font-mono text-[12px] text-slate-700`}
          />
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Thông tin tự khai (tùy chọn)
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
          Học viên + xếp hạng được tính tự động từ khóa học. Mục dưới chỉ hiển
          thị nếu bạn điền.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Kinh nghiệm</FieldLabel>
            <input
              value={c.experienceYears}
              onChange={(e) => set({ experienceYears: e.target.value })}
              placeholder="vd: 12 năm"
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
          <div>
            <FieldLabel>Địa điểm</FieldLabel>
            <input
              value={c.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="vd: Hà Nội"
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel>Thành tích nổi bật</FieldLabel>
          <input
            value={c.achievement}
            onChange={(e) => set({ achievement: e.target.value })}
            placeholder="vd: 2,400 học sinh đỗ ĐH top đầu"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      </div>
    </ExpandedShell>
  );
}

// ── About ──────────────────────────────────────────────────────────────────

interface AboutExpandedProps {
  module: AboutModuleT;
  onChange: (next: AboutModuleT) => void;
  onCollapse?: () => void;
}

export function AboutExpanded({
  module,
  onChange,
  onCollapse,
}: AboutExpandedProps) {
  const c = module.content;
  const set = (patch: Partial<typeof c>) =>
    onChange({ ...module, content: { ...c, ...patch } });

  const used = c.body.length;
  const over = used > ABOUT_CHAR_CAP;
  const overBy = used - ABOUT_CHAR_CAP;

  return (
    <ExpandedShell
      step="02 · GIỚI THIỆU"
      title="About · Đôi lời từ cô"
      icon={<Type className="h-4 w-4" />}
      onCollapse={onCollapse}
    >
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel>Nội dung</FieldLabel>
          <p
            className={`font-mono text-[10px] tabular-nums ${
              over ? "font-semibold text-rose-600" : "text-slate-400"
            }`}
          >
            {used.toLocaleString("vi-VN")} / {ABOUT_CHAR_CAP.toLocaleString("vi-VN")}
          </p>
        </div>
        <div
          className={`mt-1.5 rounded-lg border bg-white ${
            over ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5 text-slate-500">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              aria-label="In đậm"
            >
              <Bold className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              aria-label="Nghiêng"
            >
              <Italic className="h-3 w-3" />
            </button>
            <span className="h-3 w-px bg-slate-200" />
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              aria-label="Liên kết"
            >
              <Link2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              aria-label="Trích dẫn"
            >
              <Quote className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              aria-label="Danh sách"
            >
              <List className="h-3 w-3" />
            </button>
          </div>
          <textarea
            rows={6}
            value={c.body}
            onChange={(e) => set({ body: e.target.value })}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-[1.6] text-slate-800 outline-none"
          />
        </div>
        {over && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[10.5px] text-rose-600">
            <AlertTriangle className="h-3 w-3" />
            Vượt {overBy.toLocaleString("vi-VN")} ký tự — rút gọn để tiếp tục lưu.
          </p>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
        <input
          type="checkbox"
          checked={c.withQuote}
          onChange={(e) => set({ withQuote: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-300"
          style={{ accentColor: "var(--profile-accent)" }}
        />
        Hiển thị câu trích dẫn
      </label>
      {c.withQuote && (
        <div>
          <FieldLabel>Câu trích dẫn</FieldLabel>
          <input
            value={c.quote}
            onChange={(e) => set({ quote: e.target.value })}
            placeholder="Một câu nói tâm đắc về việc dạy của bạn"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      )}
    </ExpandedShell>
  );
}

// ── Featured ──────────────────────────────────────────────────────────────

interface FeaturedExpandedProps {
  module: FeaturedModuleT;
  onChange: (next: FeaturedModuleT) => void;
  onCollapse?: () => void;
}

export function FeaturedExpanded({
  module,
  onChange,
  onCollapse,
}: FeaturedExpandedProps) {
  const setVariant = (variant: "grid3" | "grid2") =>
    onChange({ ...module, variant });
  const toggleId = (id: number) => {
    const has = module.content.courseIds.includes(id);
    const next = has
      ? module.content.courseIds.filter((x) => x !== id)
      : [...module.content.courseIds, id].slice(0, 6);
    onChange({ ...module, content: { courseIds: next } });
  };

  return (
    <ExpandedShell
      step="03 · KHÓA HỌC"
      title="Khóa học nổi bật"
      icon={<CreditCard className="h-4 w-4" />}
      onCollapse={onCollapse}
    >
      <div>
        <FieldLabel>Bố cục</FieldLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(
            [
              { id: "grid3" as const, label: "3-up grid" },
              { id: "grid2" as const, label: "2-up large" },
            ]
          ).map((opt) => {
            const on = module.variant === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVariant(opt.id)}
                className={`rounded-lg border p-2.5 text-left text-[12.5px] font-medium ${
                  on
                    ? "border-slate-900 bg-slate-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel>Khóa hiển thị (tối đa 6)</FieldLabel>
          <p className="font-mono text-[10px] tabular-nums text-slate-400">
            {module.content.courseIds.length} / 6
          </p>
        </div>
        <div className="mt-1.5 space-y-1.5">
          {SAMPLE_COURSES.map((course) => {
            const on = module.content.courseIds.includes(course.id);
            return (
              <label
                key={course.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  on
                    ? "border-slate-300 bg-slate-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleId(course.id)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  style={{ accentColor: "var(--profile-accent)" }}
                />
                <span className="font-mono text-[10px] tabular-nums text-slate-400">
                  {String(course.id).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate text-[12.5px] font-medium text-slate-800">
                  {course.title}
                </span>
                <span className="font-mono text-[10.5px] text-slate-500">
                  {course.price}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </ExpandedShell>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────

interface ContactExpandedProps {
  module: ContactModuleT;
  onChange: (next: ContactModuleT) => void;
  onCollapse?: () => void;
}

export function ContactExpanded({
  module,
  onChange,
  onCollapse,
}: ContactExpandedProps) {
  const c = module.content;
  const setSocial = (idx: number, handle: string) => {
    const socials = c.socials.map((s, i) => (i === idx ? { ...s, handle } : s));
    onChange({ ...module, content: { ...c, socials } });
  };

  return (
    <ExpandedShell
      step="04 · LIÊN HỆ"
      title="Liên hệ · Footer mềm"
      icon={<Minus className="h-4 w-4" />}
      onCollapse={onCollapse}
    >
      <div>
        <FieldLabel>Email</FieldLabel>
        <input
          type="email"
          value={c.email}
          onChange={(e) =>
            onChange({ ...module, content: { ...c, email: e.target.value } })
          }
          className={`mt-1.5 ${inputCls}`}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel>Mạng xã hội</FieldLabel>
        {c.socials.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 font-mono text-[10px] uppercase tracking-wide text-slate-600">
              {s.label.slice(0, 2)}
            </span>
            <input
              value={s.handle}
              onChange={(e) => setSocial(i, e.target.value)}
              className={`flex-1 ${inputCls} font-mono text-[12px]`}
            />
          </div>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
        <input
          type="checkbox"
          checked={c.withCapture}
          onChange={(e) =>
            onChange({ ...module, content: { ...c, withCapture: e.target.checked } })
          }
          className="h-3.5 w-3.5 rounded border-slate-300"
          style={{ accentColor: "var(--profile-accent)" }}
        />
        Hiển thị form &ldquo;Nhận tin mới&rdquo;
      </label>
    </ExpandedShell>
  );
}
