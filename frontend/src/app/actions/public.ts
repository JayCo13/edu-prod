"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Public Server Actions (Marketplace)
 * ====================================
 * Read-only queries for the public-facing marketplace pages.
 * These use the anon key → RLS policies control what's visible.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublicTeacher {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string;
  description: string;
  is_public: boolean;
  created_at: string;
  // Joined from owner profile
  owner: {
    display_name: string;
    avatar_url: string;
    bio: string;
  } | null;
}

export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Get Public Teachers (Marketplace Directory) ────────────────────────────

export async function getPublicTeachers(): Promise<ActionResult<PublicTeacher[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        subdomain,
        logo_url,
        description,
        is_public,
        created_at,
        owner:profiles!tenants_owner_id_fkey (
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as unknown) as PublicTeacher[] };
  } catch {
    return { success: false, error: "Không thể tải danh sách giáo viên." };
  }
}

// ── Get Teacher By Slug ────────────────────────────────────────────────────

export async function getTeacherBySlug(
  slug: string,
): Promise<ActionResult<PublicTeacher>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        subdomain,
        logo_url,
        description,
        is_public,
        created_at,
        owner:profiles!tenants_owner_id_fkey (
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq("subdomain", slug)
      .eq("is_public", true)
      .single();

    if (error) {
      return { success: false, error: "Không tìm thấy giáo viên." };
    }

    return { success: true, data: (data as unknown) as PublicTeacher };
  } catch {
    return { success: false, error: "Không thể tải thông tin giáo viên." };
  }
}

// ── Get Tenant By Slug (No is_public filter) ───────────────────────────────
// Used by subdomain pages (/t/[slug]/*) where the tenant's subdomain
// existence proves they should be accessible.

export async function getTenantBySlug(
  slug: string,
): Promise<ActionResult<PublicTeacher>> {
  try {
    const supabase = await createClient();

    // 1. Fetch tenant (no FK join — owner_id references auth.users, not profiles)
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, subdomain, logo_url, description, is_public, created_at, owner_id")
      .eq("subdomain", slug)
      .single();

    if (tenantError || !tenant) {
      return { success: false, error: "Không tìm thấy học viện." };
    }

    // 2. Fetch owner profile separately
    let owner: PublicTeacher["owner"] = null;
    if (tenant.owner_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio")
        .eq("id", tenant.owner_id)
        .single();

      if (profile) {
        owner = profile as PublicTeacher["owner"];
      }
    }

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        logo_url: tenant.logo_url,
        description: tenant.description,
        is_public: tenant.is_public,
        created_at: tenant.created_at,
        owner,
      },
    };
  } catch (err) {
    console.error("[getTenantBySlug] EXCEPTION:", err);
    return { success: false, error: "Không thể tải thông tin học viện." };
  }
}

// ── Get Published Courses By Tenant ────────────────────────────────────────

export interface PublicCourseCard {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  price: number;
  currency: string;
  lessons_count: number;
  enrollments_count: number;
}

export async function getTeacherPublishedCourses(
  tenantId: string,
): Promise<ActionResult<PublicCourseCard[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("courses")
      .select(`
        id, title, slug, description, thumbnail_url,
        price, currency, lessons_count, enrollments_count
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as PublicCourseCard[] };
  } catch {
    return { success: false, error: "Không thể tải danh sách khóa học." };
  }
}
