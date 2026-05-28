/**
 * Payroll repository — direct Supabase queries.
 *
 * No auth, no business rules — service.ts wraps these. RLS is the
 * actual access boundary (see 0014_create_payroll.sql).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PayrollItemRow,
  PayrollPeriodRow,
  PayrollPeriodStatus,
  PayrollPeriodWithItems,
  StoredAdjustment,
  TeacherSnapshot,
} from "./domain-types";
import type { AuditEntry, PayrollBreakdown } from "./types";

type Sb = SupabaseClient;

const PERIOD_COLUMNS =
  "id,center_id,period_start,period_end,status,approved_by,approved_at,paid_at,notes,created_at,updated_at";

const ITEM_COLUMNS =
  "id,payroll_period_id,teacher_id,teacher_snapshot,calculated_amount,final_amount,adjustments,breakdown,audit_trail,notes,payment_method,paid_at,paid_by,paid_note,created_at,updated_at";

// ─── Periods ─────────────────────────────────────────────────────────────────

export async function listPeriods(
  supabase: Sb,
  centerId: string,
): Promise<PayrollPeriodRow[]> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .select(PERIOD_COLUMNS)
    .eq("center_id", centerId)
    .order("period_start", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PayrollPeriodRow[];
}

export async function findPeriod(
  supabase: Sb,
  id: string,
): Promise<PayrollPeriodRow | null> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .select(PERIOD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PayrollPeriodRow | null) ?? null;
}

export async function findPeriodWithItems(
  supabase: Sb,
  id: string,
): Promise<PayrollPeriodWithItems | null> {
  const period = await findPeriod(supabase, id);
  if (!period) return null;
  const items = await listItems(supabase, id);
  return { ...period, items };
}

export async function insertPeriod(
  supabase: Sb,
  input: {
    center_id: string;
    period_start: string;
    period_end: string;
    notes?: string;
  },
): Promise<PayrollPeriodRow> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .insert({ ...input, status: "DRAFT" as PayrollPeriodStatus })
    .select(PERIOD_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayrollPeriodRow;
}

export async function updatePeriodStatus(
  supabase: Sb,
  id: string,
  patch: Partial<
    Pick<
      PayrollPeriodRow,
      "status" | "approved_by" | "approved_at" | "paid_at" | "notes"
    >
  >,
): Promise<PayrollPeriodRow> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .update(patch)
    .eq("id", id)
    .select(PERIOD_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayrollPeriodRow;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function listItems(
  supabase: Sb,
  periodId: string,
): Promise<PayrollItemRow[]> {
  const { data, error } = await supabase
    .from("payroll_items")
    .select(ITEM_COLUMNS)
    .eq("payroll_period_id", periodId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PayrollItemRow[];
}

export async function findItem(
  supabase: Sb,
  id: string,
): Promise<PayrollItemRow | null> {
  const { data, error } = await supabase
    .from("payroll_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PayrollItemRow | null) ?? null;
}

export async function upsertItem(
  supabase: Sb,
  input: {
    payroll_period_id: string;
    teacher_id: string;
    teacher_snapshot: TeacherSnapshot;
    calculated_amount: number;
    final_amount: number;
    adjustments: StoredAdjustment[];
    breakdown: PayrollBreakdown;
    audit_trail: AuditEntry[];
    notes?: string;
  },
): Promise<PayrollItemRow> {
  const { data, error } = await supabase
    .from("payroll_items")
    .upsert(
      {
        ...input,
        notes: input.notes ?? "",
      },
      { onConflict: "payroll_period_id,teacher_id" },
    )
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayrollItemRow;
}

export async function updateItem(
  supabase: Sb,
  id: string,
  patch: Partial<
    Pick<
      PayrollItemRow,
      | "adjustments"
      | "calculated_amount"
      | "final_amount"
      | "breakdown"
      | "audit_trail"
      | "notes"
    >
  >,
): Promise<PayrollItemRow> {
  const { data, error } = await supabase
    .from("payroll_items")
    .update(patch)
    .eq("id", id)
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayrollItemRow;
}
