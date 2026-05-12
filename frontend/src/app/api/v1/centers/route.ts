/**
 * /api/v1/centers
 *   GET  — list centers the caller belongs to
 *   POST — create a new center (caller becomes CENTER_ADMIN)
 *
 * Thin Route-Handler wrapper around modules/centers/service. All auth +
 * validation + RLS happens inside the service / DB; this layer maps
 * results to HTTP. Vietnamese error messages already come from the
 * service.
 */

import { NextResponse } from "next/server";
import {
  createCenter,
  listCentersForCaller,
} from "@/modules/centers/service";
import type { CenterCreateInput } from "@/modules/centers/types";

export async function GET() {
  const result = await listCentersForCaller();
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("đăng nhập") ? 401 : 500 },
    );
  }
  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request) {
  let body: CenterCreateInput;
  try {
    body = (await request.json()) as CenterCreateInput;
  } catch {
    return NextResponse.json(
      { error: "Body JSON không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await createCenter(body);
  if (!result.success) {
    const status = result.error.includes("đăng nhập") ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: result.data }, { status: 201 });
}
