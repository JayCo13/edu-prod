import { z } from "zod";

export const ACCENT_IDS = ["indigo", "emerald", "amber", "rose", "sky", "slate"] as const;
export const HERO_VARIANTS = ["centered", "split"] as const;
export const FEATURED_VARIANTS = ["grid3", "grid2"] as const;
export const SOCIAL_IDS = ["fb", "yt", "tt"] as const;

export const ABOUT_BODY_MAX = 1500;
export const TAGLINE_MAX = 200;
export const NAME_MAX = 100;
export const ROLE_MAX = 100;

const HeroContent = z.object({
  name: z.string().min(1).max(NAME_MAX),
  role: z.string().max(ROLE_MAX).default(""),
  tagline: z.string().max(TAGLINE_MAX).default(""),
  primaryCtaLabel: z.string().max(40).default("Xem khóa học"),
  primaryCtaHref: z.string().max(200).default("#courses"),
  secondaryCtaLabel: z.string().max(40).default("Liên hệ"),
  secondaryCtaHref: z.string().max(200).default("#contact"),
  // Self-reported credentials. Optional. Empty string = don't render that pill.
  experienceYears: z.string().max(40).default(""),
  location: z.string().max(80).default(""),
  achievement: z.string().max(120).default(""),
});

const HeroModule = z.object({
  type: z.literal("hero"),
  visible: z.boolean().default(true),
  variant: z.enum(HERO_VARIANTS).default("split"),
  content: HeroContent,
});

const AboutContent = z.object({
  body: z.string().max(ABOUT_BODY_MAX).default(""),
  withQuote: z.boolean().default(false),
  quote: z.string().max(280).default(""),
});

const AboutModule = z.object({
  type: z.literal("about"),
  visible: z.boolean().default(true),
  content: AboutContent,
});

const FeaturedContent = z.object({
  courseIds: z.array(z.number()).min(0).max(6).default([]),
});

const FeaturedModule = z.object({
  type: z.literal("featured"),
  visible: z.boolean().default(true),
  variant: z.enum(FEATURED_VARIANTS).default("grid3"),
  content: FeaturedContent,
});

const ContactContent = z.object({
  email: z.string().max(200).default(""),
  socials: z
    .array(
      z.object({
        id: z.enum(SOCIAL_IDS),
        label: z.string().max(40),
        handle: z.string().max(120),
      }),
    )
    .max(3)
    .default([]),
  withCapture: z.boolean().default(true),
});

const ContactModule = z.object({
  type: z.literal("contact"),
  visible: z.boolean().default(true),
  content: ContactContent,
});

export const Module = z.discriminatedUnion("type", [
  HeroModule,
  AboutModule,
  FeaturedModule,
  ContactModule,
]);

export const ProfileLayoutSchema = z.object({
  accent: z.enum(ACCENT_IDS).default("indigo"),
  modules: z.array(Module).min(1),
});

export type Module = z.infer<typeof Module>;
export type HeroModuleT = z.infer<typeof HeroModule>;
export type AboutModuleT = z.infer<typeof AboutModule>;
export type FeaturedModuleT = z.infer<typeof FeaturedModule>;
export type ContactModuleT = z.infer<typeof ContactModule>;
export type ProfileLayout = z.infer<typeof ProfileLayoutSchema>;
