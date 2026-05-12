/**
 * Centers — Server Actions (for UI invocation).
 *
 * Thin wrappers around the service layer. The settings page calls
 * `updateCenterSettingsAction` directly from the client via `useFormState`;
 * other Server Components import the service functions instead (no need
 * for the "use server" boundary in RSC reads).
 *
 * Revalidates `/admin/settings` on mutations so the new values show on
 * navigate-back.
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  createCenter as createCenterSvc,
  getCenterById as getCenterByIdSvc,
  listCentersForCaller as listCentersSvc,
  updateCenterSettings as updateCenterSettingsSvc,
} from "./service";
import type {
  CenterCreateInput,
  CenterRow,
  CenterUpdateInput,
  CentersResult,
} from "./types";

const SETTINGS_PATH = "/admin/settings";

export async function listCentersAction(): Promise<CentersResult<CenterRow[]>> {
  return listCentersSvc();
}

export async function getCenterAction(
  id: string,
): Promise<CentersResult<CenterRow>> {
  return getCenterByIdSvc(id);
}

export async function createCenterAction(
  input: CenterCreateInput,
): Promise<CentersResult<CenterRow>> {
  const result = await createCenterSvc(input);
  if (result.success) revalidatePath(SETTINGS_PATH);
  return result;
}

export async function updateCenterSettingsAction(
  id: string,
  patch: CenterUpdateInput,
): Promise<CentersResult<CenterRow>> {
  const result = await updateCenterSettingsSvc(id, patch);
  if (result.success) revalidatePath(SETTINGS_PATH);
  return result;
}
