// OBS-1A — runtime sanitizer. This is the module that actually enforces the
// PII boundary; everything else is plumbing.
//
// ── RECONSTRUCT, NEVER COPY ─────────────────────────────────────────────────
// The input is NEVER spread, never serialized, never iterated, and never
// enumerated. A new object literal is built from an explicit key list, so a
// property the caller invented cannot survive — not because it is stripped
// afterwards, but because it is never reached in the first place. Stripping is a
// blocklist and blocklists rot; reconstruction is an allowlist and cannot.
//
// Consequently the diagnostic fields that carry leaked row data in this codebase
// — the ones a Supabase error object exposes, and the ones a thrown Error
// exposes — are not merely rejected: no code path reads them at all.
//
// ── HOSTILE INPUT ───────────────────────────────────────────────────────────
// Property reads go through `readKey`, which is try/caught, because a getter can
// throw. Nothing here recurses, so a circular object is structurally irrelevant.
// Primitives, null, arrays, proxies and objects with throwing getters all
// degrade to the fixed fallbacks rather than throwing.

import {
  OBSERVABILITY_CODE_PATTERN,
  OBSERVABILITY_FALLBACK_CODE,
  OBSERVABILITY_FALLBACK_EVENT,
  OBSERVABILITY_FALLBACK_REQUEST_ID,
  OBSERVABILITY_FALLBACK_SEVERITY,
  OBSERVABILITY_FALLBACK_STAGE,
  OBSERVABILITY_REQUEST_ID_PATTERN,
  OBSERVABILITY_SLUG_PATTERN,
  OBSERVABILITY_UUID_PATTERN,
  type ObservabilityEvent,
  type ObservabilitySeverity,
} from "./observability-types";

/** Read ONE named key, tolerating a throwing getter. Never enumerates. */
function readKey(input: unknown, key: string): unknown {
  if (input === null || typeof input !== "object") return undefined;
  try {
    return (input as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function safeSlug(value: unknown, fallback: string): string {
  return typeof value === "string" && OBSERVABILITY_SLUG_PATTERN.test(value) ? value : fallback;
}

function safeSeverity(value: unknown): ObservabilitySeverity {
  // Fails closed to "error": an unrecognised severity is more likely a defect
  // than routine traffic, and under-reporting an incident is worse than noise.
  return value === "info" || value === "warn" || value === "error"
    ? value
    : OBSERVABILITY_FALLBACK_SEVERITY;
}

function safeRequestId(value: unknown): string {
  return typeof value === "string" && OBSERVABILITY_REQUEST_ID_PATTERN.test(value)
    ? value
    : OBSERVABILITY_FALLBACK_REQUEST_ID;
}

/**
 * `null` stays null (a successful event legitimately has no code).
 * A well-formed stable code passes. Anything else becomes UNKNOWN — free text
 * must never reach a code field, because free text is where sentences live.
 */
function safeCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && OBSERVABILITY_CODE_PATTERN.test(value)
    ? value
    : OBSERVABILITY_FALLBACK_CODE;
}

function safeUuid(value: unknown): string | undefined {
  return typeof value === "string" && OBSERVABILITY_UUID_PATTERN.test(value) ? value : undefined;
}

function safeDuration(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Deployment environment. Resolved internally; never caller-supplied.
 *
 * The annotation widens `NODE_ENV` deliberately: Next types it as a three-value
 * literal union, but at runtime it is an ordinary environment variable that can
 * be absent or empty. Reading it as `string | undefined` keeps the empty and
 * missing cases reachable instead of having the type system assert them away.
 */
function resolveEnv(): string {
  const nodeEnv: string | undefined = process.env.NODE_ENV;
  return typeof nodeEnv === "string" && nodeEnv !== "" ? nodeEnv : "development";
}

/**
 * Release identity, in strict precedence order.
 *
 * The package.json version is deliberately NOT a source: it is a static `0.1.0`
 * that does not change between deploys, so attributing an incident to it would
 * be actively misleading. A commit SHA identifies exactly one build.
 */
function resolveRelease(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (typeof vercelSha === "string" && vercelSha !== "") return vercelSha;

  const publicSha = process.env.NEXT_PUBLIC_GIT_COMMIT;
  if (typeof publicSha === "string" && publicSha !== "") return publicSha;

  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV !== "production") return "development";
  return "unknown";
}

/**
 * Build a fully-validated event from untrusted input.
 *
 * Total: for ANY input value this returns a well-formed event and never throws.
 * Optional fields are omitted entirely when invalid rather than emitted as null,
 * so a malformed identifier leaves no trace at all in the payload.
 */
export function sanitizeObservabilityEvent(input: unknown): ObservabilityEvent {
  const dealerId   = safeUuid(readKey(input, "dealerId"));
  const userId     = safeUuid(readKey(input, "userId"));
  const durationMs = safeDuration(readKey(input, "durationMs"));

  const sanitized: ObservabilityEvent = {
    event:     safeSlug(readKey(input, "event"), OBSERVABILITY_FALLBACK_EVENT),
    severity:  safeSeverity(readKey(input, "severity")),
    requestId: safeRequestId(readKey(input, "requestId")),
    stage:     safeSlug(readKey(input, "stage"), OBSERVABILITY_FALLBACK_STAGE),
    code:      safeCode(readKey(input, "code")),
    env:       resolveEnv(),
    release:   resolveRelease(),
  };

  if (dealerId !== undefined)   sanitized.dealerId = dealerId;
  if (userId !== undefined)     sanitized.userId = userId;
  if (durationMs !== undefined) sanitized.durationMs = durationMs;

  return sanitized;
}
