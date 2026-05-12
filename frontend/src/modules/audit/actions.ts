"use server";

/**
 * Audit Server Actions — read-only.
 *
 * The audit log modal calls `listPeriodAuditLogsAction` on open. It
 * combines two OR-conditions (entity_type=period AND entity_id=period.id)
 * + (entity_type=item AND entity_id IN [items]) because PRD §11 wants
 * "history of this period" to include adjustments on its items, not
 * just status transitions.
 */

import { createClient } from "@/lib/supabase/server";
import { resolveCenterId } from "@/lib/auth/resolveCenterId";
import { listAuditLogs } from "./service";
import { listAuditLogsForCenter } from "./repository";
import type {
  AuditAction,
  AuditEntityType,
  AuditLogRow,
  AuditResult,
} from "./types";

export async function listAuditLogsAction(filters: {
  entity_type?: AuditEntityType;
  entity_id?: string;
  action?: AuditAction;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<AuditResult<AuditLogRow[]>> {
  return listAuditLogs(filters);
}

/**
 * Period-scoped audit feed: period-level events + every item-level event
 * for items inside that period. Single trip, ORs done in two SELECTs
 * that we merge + sort.
 */
export async function listPeriodAuditLogsAction(
  periodId: string,
  itemIds: string[],
): Promise<AuditResult<AuditLogRow[]>> {
  const resolved = await resolveCenterId({ requireRole: "CENTER_ADMIN" });
  if (!resolved.ok) return { success: false, error: resolved.message };

  try {
    const supabase = await createClient();

    const [periodLogs, itemLogs] = await Promise.all([
      listAuditLogsForCenter(supabase, resolved.centerId, {
        entity_type: "payroll_period",
        entity_id: periodId,
        limit: 500,
      }),
      itemIds.length === 0
        ? Promise.resolve([] as AuditLogRow[])
        : supabase
            .from("audit_logs")
            .select(
              "id,center_id,user_id,action,entity_type,entity_id,before,after,metadata,created_at",
            )
            .eq("center_id", resolved.centerId)
            .eq("entity_type", "payroll_item")
            .in("entity_id", itemIds)
            .order("created_at", { ascending: false })
            .limit(500)
            .then((r) => {
              if (r.error) throw r.error;
              return (r.data ?? []) as AuditLogRow[];
            }),
    ]);

    const merged = [...periodLogs, ...itemLogs].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );

    return { success: true, data: merged };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Không thể tải lịch sử.",
    };
  }
}
