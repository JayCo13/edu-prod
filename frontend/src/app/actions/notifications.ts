"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type {
  ActionResult,
  NotificationKind,
  NotificationRow,
  SessionNotificationPayload,
} from "@/types/database";

/**
 * Notifications Server Actions
 * ============================
 * In-app bell. Recipients read + mark-read via RLS-scoped Postgres calls.
 * Inserts (fan-out) go through the service-role client because RLS doesn't
 * allow tenant members to write rows targeting another user.
 */

const BELL_LIMIT = 20; // most-recent N shown in the dropdown

// ── READ: list for the bell dropdown ──────────────────────────────────────

export async function listMyNotifications(): Promise<
  ActionResult<NotificationRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(BELL_LIMIT);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as NotificationRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định.";
    return { success: false, error: msg };
  }
}

// ── READ: unread count for the dot ────────────────────────────────────────

export async function getMyUnreadCount(): Promise<ActionResult<number>> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .is("read_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: count ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định.";
    return { success: false, error: msg };
  }
}

// ── WRITE: mark one row read ──────────────────────────────────────────────

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await getCurrentTenantContext();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .is("read_at", null); // no-op if already read; recipient_id enforced by RLS
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định.";
    return { success: false, error: msg };
  }
}

// ── WRITE: mark all read (clear bell) ─────────────────────────────────────

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("tenant_id", tenant.id)
      .is("read_at", null);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định.";
    return { success: false, error: msg };
  }
}

// ── FAN-OUT: write notifications to all tenant admins ─────────────────────
//
// Called from other server actions (e.g. live-sessions) when an event
// happens that admins should see. Uses service-role to bypass RLS — the
// RLS read policy still applies to recipients fetching their own inbox.

interface FanOutArgs {
  tenantId: string;
  /** auth.users.id of the user who caused the event. Excluded from recipients. */
  actorUserId: string;
  /** Optional tenant_teachers.id snapshot for the actor (for color / link). */
  actorTeacherId: string | null;
  kind: NotificationKind;
  entityType: "live_session";
  entityId: string;
  payload: SessionNotificationPayload;
}

export async function fanOutToTenantAdmins(args: FanOutArgs): Promise<void> {
  const admin = createAdminClient();

  // Pull admin user_ids from the view created in migration 0019. The view
  // unions tenants.owner_id with active is_admin tenant_teachers.
  const { data: admins, error: adminsErr } = await admin
    .from("tenant_admin_recipients")
    .select("user_id")
    .eq("tenant_id", args.tenantId);
  if (adminsErr || !admins) return;

  // Dedup + drop the actor so a teacher who somehow is also an admin doesn't
  // ping themselves. Empty set → nothing to do.
  const recipients = Array.from(
    new Set(admins.map((r) => r.user_id as string).filter(Boolean)),
  ).filter((uid) => uid !== args.actorUserId);
  if (recipients.length === 0) return;

  const rows = recipients.map((uid) => ({
    tenant_id: args.tenantId,
    recipient_id: uid,
    actor_id: args.actorUserId,
    actor_teacher_id: args.actorTeacherId,
    kind: args.kind,
    entity_type: args.entityType,
    entity_id: args.entityId,
    payload: args.payload,
  }));

  // Best-effort: failure here must NOT block the originating action (the
  // session insert/update already succeeded by the time this runs).
  await admin.from("notifications").insert(rows);
}
