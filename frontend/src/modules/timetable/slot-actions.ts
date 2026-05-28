"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTenantContext } from "@/lib/tenant-context-server";
import type { ActionResult } from "@/types/database";
import type { TimetableSlotRow } from "./types";

/**
 * Timetable slot CRUD — the editable cells of the grid.
 *
 * A slot binds (class, day, period) → (subject, teacher?). The DB enforces:
 *   - One row per (class_id, day_of_week, period_id) — class-conflict.
 *   - One row per (teacher_id, day_of_week, period_id) where teacher_id
 *     NOT NULL — teacher-conflict.
 *
 * On unique-violation (Postgres 23505) we translate to a friendly
 * Vietnamese message so the UI can show it inline.
 */

const PATH = "/dashboard/timetable/editor";

function err<T = null>(e: unknown): ActionResult<T> {
  const message = e instanceof Error ? e.message : "Đã xảy ra lỗi không xác định.";
  return { success: false, error: message };
}

/**
 * CONVENTION — DO NOT CHANGE WITHOUT MIGRATING DATA.
 *
 * `day_of_week` follows ISO 8601:
 *   1 = Monday  → displayed in Vietnamese as "Thứ 2"
 *   2 = Tuesday → "Thứ 3"
 *   3 = Wednesday → "Thứ 4"
 *   4 = Thursday → "Thứ 5"
 *   5 = Friday → "Thứ 6"
 *   6 = Saturday → "Thứ 7"
 *   7 = Sunday → "Chủ nhật"  (schools normally don't run on Sunday)
 *
 * Past bug: editor iterated [2-7] and saved the iteration VALUE as
 * `day_of_week`, so clicks on "Thứ 7" (the 6th column visually) ended up
 * stored as day_of_week=7 (Sunday). To prevent regression, every place
 * that writes a slot must use the ISO numbers above. The display label is
 * `day + 1` (or "CN" for day 7).
 *
 * See VN_SCHOOL_DAYS / dayLabel in EditorClient.tsx + PerGradeView /
 * PublicTkbView / TkbPdfDocument / excel-export.ts.
 */
const slotSchema = z.object({
  class_id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  period_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  teacher_id: z.string().uuid().optional().nullable(),
  note: z.string().max(500).optional(),
});

export async function listSlotsForTenant(): Promise<
  ActionResult<TimetableSlotRow[]>
> {
  try {
    const { supabase, tenant } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from("timetable_slots")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as TimetableSlotRow[] };
  } catch (e) {
    return err<TimetableSlotRow[]>(e);
  }
}

/** Upsert by (class, day, period). If a slot already exists for that
 *  triple, update it (Postgres unique constraint handles the conflict).
 *  If teacher_id is set AND another class has the same teacher in that
 *  time, the partial unique index throws 23505 — caught + translated. */
export async function upsertSlot(
  input: z.infer<typeof slotSchema>,
): Promise<ActionResult<TimetableSlotRow>> {
  try {
    const parsed = slotSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể chỉnh sửa thời khoá biểu.",
      };
    }

    const row = {
      tenant_id: tenant.id,
      class_id: parsed.data.class_id,
      day_of_week: parsed.data.day_of_week,
      period_id: parsed.data.period_id,
      subject_id: parsed.data.subject_id,
      teacher_id: parsed.data.teacher_id ?? null,
      note: parsed.data.note?.trim() ?? "",
    };

    const { data, error } = await supabase
      .from("timetable_slots")
      .upsert(row, {
        onConflict: "class_id,day_of_week,period_id",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // teacher_id unique index — find which class it conflicts with.
        const { data: conflicts } = await supabase
          .from("timetable_slots")
          .select("class_id, classes:classes!timetable_slots_class_id_fkey(name)")
          .eq("teacher_id", parsed.data.teacher_id)
          .eq("day_of_week", parsed.data.day_of_week)
          .eq("period_id", parsed.data.period_id)
          .neq("class_id", parsed.data.class_id)
          .maybeSingle();
        const className =
          (conflicts as { classes?: { name?: string } } | null)?.classes?.name;
        return {
          success: false,
          error: className
            ? `Giáo viên này đang dạy lớp ${className} vào tiết này. Hãy chọn giáo viên khác hoặc bỏ trống.`
            : "Giáo viên này đã được gán cho một lớp khác vào tiết này.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath(PATH);
    return { success: true, data: data as TimetableSlotRow };
  } catch (e) {
    return err<TimetableSlotRow>(e);
  }
}

export async function deleteSlot(id: string): Promise<ActionResult> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể chỉnh sửa thời khoá biểu.",
      };
    }
    const { error } = await supabase
      .from("timetable_slots")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (error) return { success: false, error: error.message };
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return err(e);
  }
}

/**
 * Copy all slots from one class to one OR multiple destination classes.
 *
 * Use case: VN schools' classes within the same grade often share an
 * identical weekly TKB (only GVCN differs). Admins schedule 6A1 once and
 * copy the structure to 6A2–6A12, then optionally swap teachers per class.
 *
 * Options:
 * - `keepTeacher`: TRUE → copy teacher_id verbatim. FALSE → leave NULL.
 * - `overwrite`: TRUE → delete any existing slot in dest at (day, period)
 *   before inserting. FALSE → skip cells that already have a slot.
 *
 * Returns per-destination counters so the UI can summarize.
 */
const copyClassSchema = z.object({
  src_class_id: z.string().uuid(),
  dest_class_ids: z.array(z.string().uuid()).min(1).max(50),
  keep_teacher: z.boolean().default(true),
  overwrite: z.boolean().default(false),
});

export interface CopyClassResult {
  perDest: { class_id: string; copied: number; skipped: number; overwritten: number }[];
  totalCopied: number;
  totalSkipped: number;
  totalOverwritten: number;
  /** Slot rows that were inserted/overwritten — caller merges these into
   *  local state so the grid reflects the copy without a router.refresh(). */
  inserted: TimetableSlotRow[];
  /** Slot IDs that existed in dest before overwrite — caller removes these
   *  from local state. (Same shape as `before` for undo history.) */
  removedIds: string[];
}

export async function copyClassSchedule(
  input: z.infer<typeof copyClassSchema>,
): Promise<ActionResult<CopyClassResult>> {
  try {
    const parsed = copyClassSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message };
    const { src_class_id, dest_class_ids, keep_teacher, overwrite } =
      parsed.data;
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể copy TKB.",
      };
    }
    // Refuse to copy a class onto itself.
    const filtered = dest_class_ids.filter((id) => id !== src_class_id);
    if (filtered.length === 0) {
      return {
        success: false,
        error: "Chọn ít nhất 1 lớp đích khác lớp nguồn.",
      };
    }

    // Read source slots.
    const { data: srcSlots, error: srcErr } = await supabase
      .from("timetable_slots")
      .select("day_of_week, period_id, subject_id, teacher_id")
      .eq("tenant_id", tenant.id)
      .eq("class_id", src_class_id);
    if (srcErr) return { success: false, error: srcErr.message };
    if (!srcSlots || srcSlots.length === 0) {
      return {
        success: false,
        error: "Lớp nguồn chưa có slot nào để copy.",
      };
    }

    const perDest: CopyClassResult["perDest"] = [];
    const inserted: TimetableSlotRow[] = [];
    const removedIds: string[] = [];
    let totalCopied = 0;
    let totalSkipped = 0;
    let totalOverwritten = 0;

    for (const destId of filtered) {
      let copied = 0;
      let skipped = 0;
      let overwritten = 0;

      // Read existing dest slots → fast skip / overwrite decision.
      const { data: existing } = await supabase
        .from("timetable_slots")
        .select("id, day_of_week, period_id")
        .eq("tenant_id", tenant.id)
        .eq("class_id", destId);
      const existingKey = new Map<string, string>();
      for (const e of existing ?? []) {
        existingKey.set(`${e.day_of_week}|${e.period_id}`, e.id);
      }

      for (const s of srcSlots) {
        const k = `${s.day_of_week}|${s.period_id}`;
        const existingId = existingKey.get(k);
        if (existingId) {
          if (!overwrite) {
            skipped++;
            continue;
          }
          // Delete existing slot, then we'll insert fresh below.
          await supabase
            .from("timetable_slots")
            .delete()
            .eq("id", existingId)
            .eq("tenant_id", tenant.id);
          removedIds.push(existingId);
          overwritten++;
        }
        // Try insert. Teacher conflict (one teacher in two classes at the
        // same time) trips the partial unique index — translate to skip
        // OR retry without teacher.
        const insertOne = async (teacher_id: string | null) =>
          supabase
            .from("timetable_slots")
            .insert({
              tenant_id: tenant.id,
              class_id: destId,
              day_of_week: s.day_of_week,
              period_id: s.period_id,
              subject_id: s.subject_id,
              teacher_id,
            })
            .select()
            .single();

        const first = await insertOne(
          keep_teacher ? (s.teacher_id ?? null) : null,
        );
        if (first.error) {
          if (
            keep_teacher &&
            /23505|duplicate key/i.test(first.error.message)
          ) {
            const retry = await insertOne(null);
            if (!retry.error && retry.data) {
              inserted.push(retry.data as TimetableSlotRow);
              copied++;
              continue;
            }
          }
          skipped++;
        } else if (first.data) {
          inserted.push(first.data as TimetableSlotRow);
          copied++;
        }
      }

      perDest.push({ class_id: destId, copied, skipped, overwritten });
      totalCopied += copied;
      totalSkipped += skipped;
      totalOverwritten += overwritten;
    }

    revalidatePath(PATH);
    return {
      success: true,
      data: {
        perDest,
        totalCopied,
        totalSkipped,
        totalOverwritten,
        inserted,
        removedIds,
      },
    };
  } catch (e) {
    return err<CopyClassResult>(e);
  }
}

/**
 * Bulk upsert slots (used by Brush mode + multi-cell paste).
 *
 * `slots` is the desired final state for the given (class, day, period)
 * triples. Server upserts each row independently so a teacher-conflict on
 * one slot doesn't abort the rest — failed inserts are returned in
 * `errors[]`.
 */
const bulkSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        class_id: z.string().uuid(),
        day_of_week: z.number().int().min(1).max(7),
        period_id: z.string().uuid(),
        subject_id: z.string().uuid(),
        teacher_id: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export interface BulkUpsertResult {
  upserted: TimetableSlotRow[];
  errors: { class_id: string; day_of_week: number; period_id: string; message: string }[];
}

export async function bulkUpsertSlots(
  input: z.infer<typeof bulkSlotsSchema>,
): Promise<ActionResult<BulkUpsertResult>> {
  try {
    const parsed = bulkSlotsSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.issues[0].message };
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể bulk upsert.",
      };
    }

    const upserted: TimetableSlotRow[] = [];
    const errors: BulkUpsertResult["errors"] = [];
    for (const row of parsed.data.slots) {
      const { data, error } = await supabase
        .from("timetable_slots")
        .upsert(
          {
            tenant_id: tenant.id,
            class_id: row.class_id,
            day_of_week: row.day_of_week,
            period_id: row.period_id,
            subject_id: row.subject_id,
            teacher_id: row.teacher_id ?? null,
          },
          { onConflict: "class_id,day_of_week,period_id" },
        )
        .select()
        .single();
      if (error) {
        errors.push({
          class_id: row.class_id,
          day_of_week: row.day_of_week,
          period_id: row.period_id,
          message: error.message,
        });
      } else if (data) {
        upserted.push(data as TimetableSlotRow);
      }
    }

    revalidatePath(PATH);
    return { success: true, data: { upserted, errors } };
  } catch (e) {
    return err<BulkUpsertResult>(e);
  }
}

/** Bulk-delete slots by id (used by multi-select "Xoá đã chọn"). */
export async function bulkDeleteSlots(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, data: { deleted: 0 } };
    }
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên trung tâm mới có thể xoá hàng loạt.",
      };
    }
    const { data, error } = await supabase
      .from("timetable_slots")
      .delete()
      .in("id", ids)
      .eq("tenant_id", tenant.id)
      .select("id");
    if (error) return { success: false, error: error.message };
    revalidatePath(PATH);
    return { success: true, data: { deleted: (data ?? []).length } };
  } catch (e) {
    return err<{ deleted: number }>(e);
  }
}

/**
 * One-off migration: move slots from day_of_week=7 (Sunday in ISO) to
 * day_of_week=6 (Saturday). Existed because an earlier off-by-one bug in
 * PerGradeView labelled columns 2-7 but stored those labels verbatim as
 * day_of_week — admins clicking "Thứ 7" placed slots at day=7 (Sun) instead
 * of day=6 (Sat). Idempotent: returns count of rows updated.
 *
 * If a Saturday slot already exists for the same (class, period), the
 * Sunday slot is DELETED to avoid violating the unique constraint.
 */
export async function migrateLegacyDay7ToSaturday(): Promise<
  ActionResult<{ shifted: number; deleted: number }>
> {
  try {
    const { supabase, tenant, isAdmin } = await getCurrentTenantContext();
    if (!isAdmin) {
      return {
        success: false,
        error: "Chỉ quản trị viên mới có thể chạy migration.",
      };
    }

    // Find all day=7 slots for this tenant.
    const { data: day7, error: readErr } = await supabase
      .from("timetable_slots")
      .select("id, class_id, period_id")
      .eq("tenant_id", tenant.id)
      .eq("day_of_week", 7);
    if (readErr) return { success: false, error: readErr.message };
    if (!day7 || day7.length === 0) {
      return { success: true, data: { shifted: 0, deleted: 0 } };
    }

    // For each day=7 slot, check if a day=6 slot already exists for the
    // same (class, period). If yes → DELETE the day=7 row to avoid the
    // (class, day, period) UNIQUE constraint. If no → UPDATE day=7 → 6.
    let shifted = 0;
    let deleted = 0;
    for (const row of day7) {
      const { data: existing, error: e } = await supabase
        .from("timetable_slots")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("class_id", row.class_id)
        .eq("period_id", row.period_id)
        .eq("day_of_week", 6)
        .maybeSingle();
      if (e) continue;
      if (existing) {
        await supabase
          .from("timetable_slots")
          .delete()
          .eq("id", row.id)
          .eq("tenant_id", tenant.id);
        deleted++;
      } else {
        await supabase
          .from("timetable_slots")
          .update({ day_of_week: 6 })
          .eq("id", row.id)
          .eq("tenant_id", tenant.id);
        shifted++;
      }
    }

    revalidatePath(PATH);
    return { success: true, data: { shifted, deleted } };
  } catch (e) {
    return err<{ shifted: number; deleted: number }>(e);
  }
}
