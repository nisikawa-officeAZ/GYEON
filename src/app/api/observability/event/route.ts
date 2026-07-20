// OBS-1P — first-party observability event endpoint.
//
// The server half of the browser transport: it exists so an `obs.*` support code
// a user reads off a crash screen is searchable by an operator, instead of
// living only in that user's devtools console.
//
// ── THIS IS A PUBLIC, UNAUTHENTICATED ENDPOINT ──────────────────────────────
// It must be, because the incidents worth reporting include the global error
// boundary and the login page, where no session exists. Everything below is
// shaped by that: it is bounded by DESIGN rather than by trust.
//
//   • Allowlist, not blocklist. Four keys, three of them fixed literals. An
//     unknown key rejects the whole request — there is no shape in which a raw
//     Error, stack, digest, message, URL, cookie, email or metadata bag can be
//     expressed, so none has to be stripped.
//   • The body is read as BYTES with a hard cap. `Content-Length` is a hint used
//     for an early reject only; it can be absent or lie, so the streamed count
//     is authoritative.
//   • `env`, `release` and severity are supplied by the SERVER. A caller cannot
//     misattribute an incident to another build or downgrade its severity.
//   • `dealerId`/`userId` are not accepted at all. An anonymous caller asserting
//     a tenant id would let anyone attribute incidents to any tenant.
//   • Rejected requests emit NOTHING. Logging rejected junk is what would turn a
//     size-capped endpoint into a log-injection amplifier.
//   • No database, no Storage, no external provider. One console line.
//
// Rate limiting is NOT implemented here. In serverless execution each concurrent
// instance holds its own memory, so an in-process counter enforces N × instances
// and resets on every cold start — the appearance of a limit with none of the
// effect. It belongs at the WAF, in front of this function. See
// docs/OBSERVABILITY_TRANSPORT_RUNBOOK.md.

import { reportObservabilityEvent } from "@/lib/observability/report-observability-event";
import {
  TRANSPORTABLE_EVENT, TRANSPORTABLE_CODE, TRANSPORTABLE_STAGES,
} from "@/lib/observability/observability-transport";

/** Every request is unique; nothing here may be cached or statically evaluated. */
export const dynamic = "force-dynamic";

/**
 * Hard byte cap. A valid DTO is ~150 bytes, so 1 KiB is generous for the shape
 * while leaving no room for a payload worth injecting.
 */
const MAX_BODY_BYTES = 1024;

/** `obs.<32 lowercase hex>` only — `obs.unattributed` is deliberately excluded. */
const ATTRIBUTED_REQUEST_ID = /^obs\.[0-9a-f]{32}$/;

const ALLOWED_KEYS = ["requestId", "event", "stage", "code"] as const;

/** 204 with no body: the client is told nothing, not even its own support code. */
const accepted = () => new Response(null, { status: 204 });
/** No reason phrase, no field name, no echo of input. */
const rejected = (status: 400 | 413) => new Response(null, { status });

/**
 * Read the body with the byte cap enforced on the STREAM.
 *
 * Counting bytes as they arrive is the only honest cap: a hostile client can
 * omit `Content-Length` or send a small one with a large body, and a
 * `req.text()` that buffers first would have already accepted the payload
 * before any check could run.
 */
async function readBoundedBody(req: Request): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    // Only a trustworthy-looking oversize claim short-circuits. A missing,
    // non-numeric or understated value simply falls through to the real count.
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) return { ok: false };
  }

  const body = req.body;
  if (!body) return { ok: true, text: "" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: true, text: "" };   // unreadable body → invalid, not oversized
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { joined.set(c, offset); offset += c.byteLength; }
  return { ok: true, text: new TextDecoder().decode(joined) };
}

type ValidBody = {
  requestId: string;
  stage: (typeof TRANSPORTABLE_STAGES)[number];
};

/** Strict allowlist validation. Any deviation returns null; nothing is coerced. */
function validate(parsed: unknown): ValidBody | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const keys = Object.keys(parsed as Record<string, unknown>);
  if (keys.length !== ALLOWED_KEYS.length) return null;
  for (const k of keys) {
    if (!(ALLOWED_KEYS as readonly string[]).includes(k)) return null;
  }

  const o = parsed as Record<string, unknown>;
  if (o.event !== TRANSPORTABLE_EVENT) return null;
  if (o.code !== TRANSPORTABLE_CODE) return null;
  if (typeof o.stage !== "string") return null;
  if (!(TRANSPORTABLE_STAGES as readonly string[]).includes(o.stage)) return null;
  if (typeof o.requestId !== "string" || !ATTRIBUTED_REQUEST_ID.test(o.requestId)) return null;

  return { requestId: o.requestId, stage: o.stage as ValidBody["stage"] };
}

/**
 * Exact media-type match, parameters permitted only AFTER it.
 *
 * A substring or prefix test is not good enough here, and the difference is not
 * theoretical. `includes("application/json")` accepts `application/jsonp`,
 * `application/ld+json`, `application/json-patch+json`, `text/application/json`
 * and even `text/plain; x=application/json` — a body that is not the media type
 * this route parses, arriving under a header that merely mentions it.
 * `startsWith` is no better: it still admits `application/jsonp`.
 *
 * RFC 9110 media types are case-insensitive and may carry `; parameter=value`
 * suffixes, so the value is split at the FIRST `;`, trimmed of surrounding
 * whitespace, lowercased, and compared for EQUALITY. Anything before that
 * separator that is not exactly `application/json` is rejected.
 */
function isExactJsonMediaType(headerValue: string | null): boolean {
  if (headerValue === null) return false;
  const mediaType = headerValue.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * Reject a PRESENT but foreign `Origin`; accept an ABSENT one.
 *
 * Absence is accepted on purpose. Rejecting it buys nothing — a scripted client
 * sets any header it likes — while it would break legitimate boundary reports
 * where the header is not sent. Volume is the real control, and volume is the
 * WAF's job.
 */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!originAllowed(req)) return rejected(400);

  if (!isExactJsonMediaType(req.headers.get("content-type"))) return rejected(400);

  const body = await readBoundedBody(req);
  if (!body.ok) return rejected(413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    // The parse error is deliberately not logged: it is attacker-controlled text.
    return rejected(400);
  }

  const valid = validate(parsed);
  if (valid === null) return rejected(400);

  // Reconstructed from the two validated values plus fixed literals. `severity`,
  // `env` and `release` are the server's; nothing from the request object is
  // forwarded. Running on the server, this reaches consoleSink — never back into
  // the browser transport.
  reportObservabilityEvent({
    event: TRANSPORTABLE_EVENT,
    severity: "error",
    requestId: valid.requestId,
    stage: valid.stage,
    code: TRANSPORTABLE_CODE,
  });

  return accepted();
}
