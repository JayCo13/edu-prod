/**
 * /api/v1/centers/:id
 *   GET   — fetch one center (RLS returns 404 for non-members)
 *   PATCH — update settings (CENTER_ADMIN only)
 *
 * Route params are async in Next.js 16 — must await `params`.
 */

import { NextResponse } from "next/server";
import {
  getCenterById,
  updateCenterSettings,
} from "@/modules/centers/service";
import type { CenterUpdateInput } from "@/modules/centers/types";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await getCenterById(id);
  if (!result.success) {
    const status = result.error.includes("đăng nhập")
      ? 401
      : result.error.includes("Không tìm thấy")
        ? 404
        : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  let body: CenterUpdateInput;
  try {
    body = (await request.json()) as CenterUpdateInput;
  } catch {
    return NextResponse.json(
      { error: "Body JSON không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await updateCenterSettings(id, body);
  if (!result.success) {
    const status = result.error.includes("đăng nhập")
      ? 401
      : result.error.includes("quyền")
        ? 403
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}
