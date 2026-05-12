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
