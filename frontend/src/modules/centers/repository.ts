/**
 * Centers repository — direct Supabase queries.
 *
 * No auth, no business rules — that lives in service.ts. Tests can stub
 * this layer to exercise service logic without hitting a real DB.
 *
 * RLS is the actual access boundary (see 0013_create_centers.sql). These
 * functions assume the caller has already done resolveCenterId() (or
 * equivalent) for authorization.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CenterCreateInput,
  CenterRow,
  CenterUpdateInput,
  UserCenterRow,
} from "./types";

type Sb = SupabaseClient;

const CENTER_COLUMNS =
  "id,name,address,phone,logo_url,timezone,currency,settings,subscription_plan,subscription_status,created_at,updated_at";

export async function findCenterById(
  supabase: Sb,
  id: string,
): Promise<CenterRow | null> {
  const { data, error } = await supabase
    .from("centers")
    .select(CENTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CenterRow | null) ?? null;
}

export async function findCentersForUser(
  supabase: Sb,
  userId: string,
): Promise<CenterRow[]> {
  // The "centers: member read" RLS policy already filters by membership,
  // but we still join through user_centers to guarantee ordering by
  // membership creation time (which RLS doesn't impose).
  const { data, error } = await supabase
    .from("user_centers")
    .select(`center:centers(${CENTER_COLUMNS})`)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Supabase JS infers the joined relation as an array (it can't know the
  // FK is unique). At runtime it's a single object for a to-one relation;
  // narrow defensively to handle both shapes.
  return (data ?? [])
    .map((row) => {
      const center = (row as { center: CenterRow | CenterRow[] | null }).center;
      if (Array.isArray(center)) return center[0] ?? null;
      return center;
    })
    .filter((c): c is CenterRow => c !== null);
}

export async function insertCenter(
  supabase: Sb,
  input: CenterCreateInput,
): Promise<CenterRow> {
  const { data, error } = await supabase
    .from("centers")
    .insert({
      name: input.name,
      address: input.address ?? "",
      phone: input.phone ?? "",
      logo_url: input.logo_url ?? "",
      timezone: input.timezone ?? "Asia/Ho_Chi_Minh",
      // Currency is locked to VND in v1 (PRD §5.2). Accepting the field for
      // future use but defaulting hard.
      currency: input.currency ?? "VND",
      settings: input.settings ?? {},
    })
    .select(CENTER_COLUMNS)
    .single();

  if (error) throw error;
  return data as CenterRow;
}

export async function updateCenter(
  supabase: Sb,
  id: string,
  patch: CenterUpdateInput,
): Promise<CenterRow> {
  const { data, error } = await supabase
    .from("centers")
    .update(patch)
    .eq("id", id)
    .select(CENTER_COLUMNS)
    .single();

  if (error) throw error;
  return data as CenterRow;
}

export async function insertUserCenter(
  supabase: Sb,
  userId: string,
  centerId: string,
  role: UserCenterRow["role_in_center"],
): Promise<UserCenterRow> {
  const { data, error } = await supabase
    .from("user_centers")
    .insert({
      user_id: userId,
      center_id: centerId,
      role_in_center: role,
      status: "ACTIVE",
    })
    .select("id,user_id,center_id,role_in_center,status,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as UserCenterRow;
}

export async function findMembership(
  supabase: Sb,
  userId: string,
  centerId: string,
): Promise<UserCenterRow | null> {
  const { data, error } = await supabase
    .from("user_centers")
    .select("id,user_id,center_id,role_in_center,status,created_at,updated_at")
    .eq("user_id", userId)
    .eq("center_id", centerId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserCenterRow | null) ?? null;
}
