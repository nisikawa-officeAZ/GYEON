// OBS-1A — the canonical observability event contract.
//
// PURE TYPES + PATTERNS. No React, no Next, no Supabase, no network, no storage,
// no monitoring vendor. Nothing here reaches a database, a route, or the save path.
//
// ── WHY THE SHAPE IS CLOSED ─────────────────────────────────────────────────
// `ObservabilityEvent` has NO index signature, no `metadata`, no `context`, no
// `tags` and no additional-properties container. That is deliberate and is the
// single most important property in this module: a bag-shaped field is how PII
// reaches a log. A caller cannot attach a customer name, a VIN, an estimate
// total, a note, a cookie or an idempotency key, because the type provides
// nowhere to put one — and the runtime sanitizer reconstructs the object from an
// explicit key list rather than copying, so an untyped caller cannot either.

export type ObservabilitySeverity = "info" | "warn" | "error";

/**
 * The complete emitted event. Every field is scalar and non-sensitive.
 *
 * `dealerId` / `userId` are OPAQUE identifiers, included only when they are
 * UUID-shaped — they identify a tenant and an actor for correlation, and carry
 * no personal content themselves.
 *
 * `env` and `release` are resolved INTERNALLY and are never accepted from a
 * caller, so they cannot be spoofed into misattributing an incident.
 */
export type ObservabilityEvent = {
  event:      string;
  severity:   ObservabilitySeverity;
  requestId:  string;
  stage:      string;
  code:       string | null;
  dealerId?:  string;
  userId?:    string;
  durationMs?: number;
  env:        string;
  release:    string;
};

/** Where a sanitized event is delivered. Injectable for tests and a future adapter. */
export type ObservabilitySink = (event: ObservabilityEvent) => void;

// ── Validation patterns ─────────────────────────────────────────────────────
// Every pattern is anchored and length-bounded. An unbounded pattern would let a
// hostile caller smuggle arbitrary text through a field that merely "looks" safe.

/** `event` and `stage`: lowercase kebab slug, 1..64 chars. */
export const OBSERVABILITY_SLUG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** `code`: the stable SCREAMING_SNAKE vocabulary already used across the save path. */
export const OBSERVABILITY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * `requestId`: the canonical observability identifier, and nothing else.
 *
 * ── WHY THE SEPARATOR IS A DOT ──────────────────────────────────────────────
 * The authoritative idempotency-key language is `/^[A-Za-z0-9_-]{16,64}$/`
 * (wizard-save-intent-types.ts). That alphabet CONTAINS `_`, so an underscore
 * prefix such as `obs_…` or `req_…` is a naming convention, not a boundary — a
 * string can satisfy both languages at once, and a key could in principle be
 * logged as a correlation id.
 *
 * `.` is NOT in the idempotency alphabet. Requiring a literal dot therefore
 * makes the two languages provably DISJOINT rather than merely different: every
 * value this pattern accepts is structurally impossible as an idempotency key,
 * and every valid idempotency key is rejected here. The separation is enforced
 * by the grammar, not by a prefix anyone could imitate.
 *
 * The body is fixed too — 32 lowercase hex, or the single fallback literal — so
 * arbitrary text cannot ride in behind a correct prefix.
 */
export const OBSERVABILITY_REQUEST_ID_PATTERN = /^obs\.(?:[0-9a-f]{32}|unattributed)$/;

/** `dealerId` / `userId`: canonical grouped UUID shape only. */
export const OBSERVABILITY_UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── Fail-closed fallbacks ───────────────────────────────────────────────────
// Every fallback is a fixed, non-sensitive literal. None is derived from input.

export const OBSERVABILITY_FALLBACK_REQUEST_ID = "obs.unattributed";
export const OBSERVABILITY_FALLBACK_EVENT      = "unknown-event";
export const OBSERVABILITY_FALLBACK_STAGE      = "unknown-stage";
export const OBSERVABILITY_FALLBACK_CODE       = "UNKNOWN";
export const OBSERVABILITY_FALLBACK_SEVERITY: ObservabilitySeverity = "error";

/** The ONLY keys ever read from caller input. Nothing outside this list is touched. */
export const OBSERVABILITY_INPUT_KEYS = [
  "event", "severity", "requestId", "stage", "code",
  "dealerId", "userId", "durationMs",
] as const;

/** The exact key set a sanitized event may expose. */
export const OBSERVABILITY_EVENT_KEYS = [
  "event", "severity", "requestId", "stage", "code",
  "dealerId", "userId", "durationMs", "env", "release",
] as const;
