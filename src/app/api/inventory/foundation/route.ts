import { NextResponse } from "next/server";

import {
  isExactJsonMediaType,
  mutationOriginAllowed,
  readBoundedJsonBody,
} from "../../../../lib/inventory/foundation/foundation-route-guards";
import {
  executeFoundationServerBoundary,
  publicStatusFor,
  type FoundationBoundaryPublicCode,
  type FoundationBoundaryResult,
} from "../../../../lib/inventory/foundation/foundation-server-actions";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private" } as const;

function failure(
  code: FoundationBoundaryPublicCode,
  status?: number,
): NextResponse {
  return NextResponse.json(
    { ok: false, code },
    { status: status ?? publicStatusFor(code), headers: NO_STORE },
  );
}

function success(result: Extract<FoundationBoundaryResult, { ok: true }>): NextResponse {
  return NextResponse.json(result, { status: 200, headers: NO_STORE });
}

function methodNotAllowed(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: { ...NO_STORE, Allow: "GET, POST" },
  });
}

function parseQuantityQuery(req: Request): Record<string, unknown> | null {
  const url = new URL(req.url);
  const extra = [...url.searchParams.keys()].some(
    (key) =>
      ![
        "actorId",
        "operatorId",
        "expectedAuthorityVersion",
        "requiredLocationIds",
        "bookProductId",
        "expectedMappingRevision",
      ].includes(key),
  );
  if (extra) return null;
  const locations = url.searchParams.getAll("requiredLocationIds");
  const version = Number(url.searchParams.get("expectedAuthorityVersion"));
  const mappingRevision = url.searchParams.get("expectedMappingRevision");
  return {
    actorId: url.searchParams.get("actorId"),
    operatorId: url.searchParams.get("operatorId"),
    expectedAuthorityVersion: Number.isFinite(version) ? version : url.searchParams.get("expectedAuthorityVersion"),
    requiredLocationIds: locations,
    operation: "quantity_query",
    ...(url.searchParams.get("bookProductId")
      ? { bookProductId: url.searchParams.get("bookProductId") }
      : {}),
    ...(mappingRevision !== null
      ? { expectedMappingRevision: Number(mappingRevision) }
      : {}),
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const parsed = parseQuantityQuery(req);
    if (!parsed) return failure("invalid_request");
    const result = await executeFoundationServerBoundary(parsed);
    if (!result.ok) return failure(result.code);
    return success(result);
  } catch {
    return failure("downstream_failure");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!mutationOriginAllowed(req)) return failure("invalid_request");
    if (!isExactJsonMediaType(req.headers.get("content-type"))) {
      return failure("invalid_request");
    }
    const body = await readBoundedJsonBody(req);
    if (!body.ok) {
      return failure("invalid_request", body.status);
    }
    const result = await executeFoundationServerBoundary(body.value);
    if (!result.ok) return failure(result.code);
    return success(result);
  } catch {
    return failure("downstream_failure");
  }
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