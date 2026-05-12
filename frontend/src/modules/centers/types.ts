/**
 * Centers module — type definitions.
 *
 * Mirrors the Supabase schema from 0013_create_centers.sql. Hand-rolled
 * (not generated) so the active type surface stays clean and intentional;
 * see PRD §6 for the canonical field list.
 */

export type CenterRole = "CENTER_ADMIN" | "CENTER_STAFF" | "TEACHER";

export type CenterMemberStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export type CenterSubscriptionPlan =
  | "STARTER"
  | "GROWTH"
  | "PRO"
  | "ENTERPRISE";

export type CenterSubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED";

/**
 * Per-center settings bag (JSONB column). All fields optional — the DB
 * default is `{}` and the UI shows fallbacks for absent values.
 *
 * Add new keys here as Phase-2+ features need them (payroll_rules,
 * default_class_duration, business_hours, etc.). Money fields go in as
 * **integer đồng (VND)** — never floats — per CLAUDE.md §8.1.
 */
export interface CenterSettings {
  /** 24-hour HH:mm strings, e.g. { open: "08:00", close: "21:00" }. */
  business_hours?: {
    open: string;
    close: string;
  };
  /** Minutes. Default 90 per PRD §5.2. */
  default_class_duration?: number;
  /** Free-form per-center notes (admin-only). */
  notes?: string;
}

export interface CenterRow {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo_url: string;
  timezone: string;
  currency: string;
  settings: CenterSettings;
  subscription_plan: CenterSubscriptionPlan;
  subscription_status: CenterSubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface UserCenterRow {
  id: string;
  user_id: string;
  center_id: string;
  role_in_center: CenterRole;
  status: CenterMemberStatus;
  created_at: string;
  updated_at: string;
}

/** Shape accepted by the create-center API. */
export interface CenterCreateInput {
  name: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  timezone?: string;
  /** Caller cannot override the v1-locked VND default, but the field is here for type completeness. */
  currency?: string;
  settings?: CenterSettings;
}

/** Shape accepted by the update-settings API (PATCH /api/v1/centers/:id). */
export interface CenterUpdateInput {
  name?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  timezone?: string;
  settings?: CenterSettings;
}

/** Uniform result wrapper used by service + actions. Mirrors existing pattern. */
export type CentersResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
