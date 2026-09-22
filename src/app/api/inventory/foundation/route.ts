import { NextResponse } from "next/server";

import {
  executeFoundationServerBoundary,
  FOUNDATION_BOUNDARY_MAX_BODY_BYTES,
  publicStatusFor,
  type FoundationBoundaryPublicCode,
  type FoundationBoundaryResult,
} from "../../../../lib/inventory/foundation/foundation-server-actions.js";

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

export function isExactJsonMediaType(headerValue: string | null): boolean {
  if (headerValue === null) return false;
  const mediaType = headerValue.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json";
}

export function mutationOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export async function readBoundedJsonBody(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > FOUNDATION_BOUNDARY_MAX_BODY_BYTES) {
      return { ok: false, status: 413 };
    }
  }

  const body = req.body;
  if (!body) return { ok: false, status: 400 };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > FOUNDATION_BOUNDARY_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(joined)) };
  } catch {
    return { ok: false, status: 400 };
  }
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