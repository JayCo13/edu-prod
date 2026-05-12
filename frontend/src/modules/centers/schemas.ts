/**
 * Centers module — Zod schemas.
 *
 * Validation strings are in Vietnamese per CLAUDE.md §8.3.
 */

import { z } from "zod";

/** Vietnamese-friendly trimmed-string helper. */
const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} quá dài (tối đa ${max} ký tự).`);

// Asia/Ho_Chi_Minh is the default; we allow IANA-style "Region/City" so
// future markets just work. Empty string is rejected at the schema boundary.
const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Múi giờ không được để trống.")
  .regex(/^[A-Za-z]+\/[A-Za-z_]+$/, "Múi giờ không hợp lệ.");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9 +()\-.]*$/, "Số điện thoại chỉ chứa chữ số và khoảng trắng.")
  .max(40);

const settingsSchema = z
  .object({
    business_hours: z
      .object({
        open: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Giờ mở cửa phải theo định dạng HH:mm."),
        close: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Giờ đóng cửa phải theo định dạng HH:mm."),
      })
      .optional(),
    default_class_duration: z
      .number()
      .int("Thời lượng buổi học phải là số nguyên (phút).")
      .min(15, "Thời lượng buổi học tối thiểu 15 phút.")
      .max(480, "Thời lượng buổi học tối đa 480 phút.")
      .optional(),
    notes: trimmed(2000, "Ghi chú").optional(),
  })
  .strict();

export const centerCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tên trung tâm không được để trống.")
      .max(200, "Tên trung tâm quá dài (tối đa 200 ký tự)."),
    address: trimmed(500, "Địa chỉ").optional(),
    phone: phoneSchema.optional(),
    logo_url: z
      .string()
      .trim()
      .url("URL logo không hợp lệ.")
      .or(z.literal(""))
      .optional(),
    timezone: timezoneSchema.optional(),
    settings: settingsSchema.optional(),
  })
  .strict();

export const centerUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tên trung tâm không được để trống.")
      .max(200, "Tên trung tâm quá dài.")
      .optional(),
    address: trimmed(500, "Địa chỉ").optional(),
    phone: phoneSchema.optional(),
    logo_url: z
      .string()
      .trim()
      .url("URL logo không hợp lệ.")
      .or(z.literal(""))
      .optional(),
    timezone: timezoneSchema.optional(),
    settings: settingsSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Phải cung cấp ít nhất một trường để cập nhật.",
  });

export type CenterCreate = z.infer<typeof centerCreateSchema>;
export type CenterUpdate = z.infer<typeof centerUpdateSchema>;
