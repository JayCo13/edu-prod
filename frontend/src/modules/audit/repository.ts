/**
 * Audit repository — direct Supabase queries.
 *
 * Append-only: only insert + select. No update / delete by design;
 * the migration has no policies for those operations either.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditListFilters,
  AuditLogInput,
  AuditLogRow,
} from "./types";

type Sb = SupabaseClient;

const COLUMNS =
  "id,center_id,user_id,action,entity_type,entity_id,before,after,metadata,created_at";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function insertAuditLog(
  supabase: Sb,
  input: AuditLogInput,
): Promise<AuditLogRow> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert(input)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as AuditLogRow;
}

export async function listAuditLogsForCenter(
  supabase: Sb,
  centerId: string,
  filters: AuditListFilters = {},
): Promise<AuditLogRow[]> {
  let q = supabase
    .from("audit_logs")
    .select(COLUMNS)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (filters.entity_type) q = q.eq("entity_type", filters.entity_type);
  if (filters.entity_id) q = q.eq("entity_id", filters.entity_id);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.user_id) q = q.eq("user_id", filters.user_id);
  if (filters.date_from) q = q.gte("created_at", `${filters.date_from}T00:00:00+07:00`);
  if (filters.date_to) q = q.lte("created_at", `${filters.date_to}T23:59:59+07:00`);

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}
