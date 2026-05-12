/**
 * Payroll Server Actions — UI invocation surface.
 *
 * Reads are direct service calls (no extra wrapper); mutations
 * revalidate the affected paths so the page reflects the new state on
 * next render.
 *
 * Excel export is a *route handler* (binary download — Server Actions
 * are awkward for files); see app/api/v1/payroll-periods/[id]/export.
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  addAdjustment,
  approvePeriod,
  createPayrollPeriod,
  getPayrollPeriod,
  listPayrollPeriods,
  markPeriodPaid,
  removeAdjustment,
} from "./service";

const LIST_PATH = "/admin/payroll";
const periodPath = (id: string) => `/admin/payroll/${id}`;

export async function listPayrollPeriodsAction() {
  return listPayrollPeriods();
}

export async function getPayrollPeriodAction(id: string) {
  return getPayrollPeriod(id);
}

/**
 * Creates an empty DRAFT period for the given month. Items are populated
 * by a separate flow (seed script today; sessions-module integration
 * later). Until then the UI lets admins create the shell and add
 * adjustments to manually-seeded items.
 */
export async function createEmptyPayrollPeriodAction(input: {
  period_start: string;
  period_end: string;
  notes?: string;
}) {
  const r = await createPayrollPeriod({
    period_start: input.period_start,
    period_end: input.period_end,
    notes: input.notes,
    teachers: [],
    sessions: [],
  });
  if (r.success) revalidatePath(LIST_PATH);
  return r;
}

export async function addAdjustmentAction(
  itemId: string,
  periodId: string,
  input: { type: "BONUS" | "DEDUCTION"; amount: number; reason: string },
) {
  const r = await addAdjustment(itemId, input);
  if (r.success) revalidatePath(periodPath(periodId));
  return r;
}

export async function removeAdjustmentAction(
  itemId: string,
  periodId: string,
  adjustmentId: string,
) {
  const r = await removeAdjustment(itemId, adjustmentId);
  if (r.success) revalidatePath(periodPath(periodId));
  return r;
}

export async function approvePayrollAction(periodId: string) {
  const r = await approvePeriod(periodId);
  if (r.success) {
    revalidatePath(periodPath(periodId));
    revalidatePath(LIST_PATH);
  }
  return r;
}

export async function markPayrollPaidAction(periodId: string) {
  const r = await markPeriodPaid(periodId);
  if (r.success) {
    revalidatePath(periodPath(periodId));
    revalidatePath(LIST_PATH);
  }
  return r;
}
