export type AccentId = "indigo" | "emerald" | "amber" | "rose" | "sky" | "slate";

export const ACCENTS: Record<AccentId, { hex: string; tint: string; label: string }> = {
  indigo: { hex: "#4f46e5", tint: "rgba(79,70,229,0.12)", label: "Indigo" },
  emerald: { hex: "#059669", tint: "rgba(5,150,105,0.12)", label: "Emerald" },
  amber: { hex: "#d97706", tint: "rgba(217,119,6,0.14)", label: "Amber" },
  rose: { hex: "#e11d48", tint: "rgba(225,29,72,0.12)", label: "Rose" },
  sky: { hex: "#0284c7", tint: "rgba(2,132,199,0.12)", label: "Sky" },
  slate: { hex: "#0f172a", tint: "rgba(15,23,42,0.10)", label: "Slate" },
};

export type ModuleId = "hero" | "about" | "featured" | "contact";

export type HeroVariant = "centered" | "split";
export type FeaturedVariant = "grid3" | "grid2";

export const ABOUT_CHAR_CAP = 1500;

export const MODULE_META: Record<
  ModuleId,
  { title: string; sub: string; required?: boolean }
> = {
  hero: {
    title: "Hero · Giới thiệu cá nhân",
    sub: "Bắt buộc · Centered / Split",
    required: true,
  },
  about: { title: "About · Đôi lời từ cô", sub: "Rich text · 1,500 ký tự" },
  featured: { title: "Khóa học nổi bật", sub: "3 — 6 khóa của bạn · 3-up / 2-up" },
  contact: { title: "Liên hệ · Footer mềm", sub: "Email + 3 mạng xã hội + Nhận tin" },
};
