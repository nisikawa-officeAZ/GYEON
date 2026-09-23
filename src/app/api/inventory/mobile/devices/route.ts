import { NextResponse } from "next/server";

import {
  executeMobileDeviceBoundary,
  isExactJsonMediaType,
  publicStatusFor,
  readBoundedJsonBody,
} from "../../../../../lib/inventory/mobile/office-az-inventory-mobile-server";
import type { MobileBoundaryPublicCode } from "../../../../../lib/inventory/mobile/office-az-inventory-mobile-session-types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private" } as const;

function failure(code: MobileBoundaryPublicCode, status?: number): NextResponse {
  return NextResponse.json(
    { ok: false, code },
    { status: status ?? publicStatusFor(code), headers: NO_STORE },
  );
}

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: { ...NO_STORE, Allow: "POST" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!isExactJsonMediaType(req.headers.get("content-type"))) {
      return failure("invalid_request");
    }
    const body = await readBoundedJsonBody(req);
    if (!body.ok) return failure("invalid_request", body.status);
    const result = await executeMobileDeviceBoundary(
      body.value,
      req.headers.get("authorization"),
    );
    return NextResponse.json(result, {
      status: result.ok ? 200 : publicStatusFor(result.code),
      headers: NO_STORE,
    });
  } catch {
    return failure("downstream_failure");
  }
}

export async function GET(): Promise<NextResponse> {
  return methodNotAllowed();
}
export async function PUT(): Promise<NextResponse> {
  return methodNotAllowed();
}
export async function PATCH(): Promise<NextResponse> {
  return methodNotAllowed();
}
export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowed();
}
export async function HEAD(): Promise<NextResponse> {
  return methodNotAllowed();
}
export async function OPTIONS(): Promise<NextResponse> {
  return methodNotAllowed();
}
