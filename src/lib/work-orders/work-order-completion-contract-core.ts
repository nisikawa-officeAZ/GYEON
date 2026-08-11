// GDA-1W-C3 — Work-order completion contract — PURE CORE.
//
// No React, no server module, no Supabase, no DB, no `server-only`, no clock, no randomness, no
// `any`, no imports. This module is the single TypeScript authority for the completion contract
// fixed by docs/master_specification/GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md (§3.2, §3.4, §5.4,
// §6): the monetary-free performed-work snapshot shape, the idempotency-key format, the completion
// state transition, the actual-end-at window, and the CANONICAL fingerprint serialization that the
// database mirrors byte-for-byte.
//
// ── WHY A PURE CORE ─────────────────────────────────────────────────────────────
// The database function `public.complete_work_order_v1` is the runtime authority: it re-validates
// everything here and its computed fingerprint is the one that is stored. This module exists so
// that (a) the application can reject an invalid intent BEFORE a network round-trip with the same
// stable domain codes the database returns, and (b) the canonicalization has one reviewable
// TypeScript definition whose test vectors are shared with the PostgreSQL implementation. Any
// divergence between this file and the migration is a defect in whichever side changed.
//
// ── CANONICALIZATION IS A WIRE CONTRACT ─────────────────────────────────────────
// The fingerprint is lowercase SHA-256 over ONE canonical JSON text. Key order, spacing, escaping,
// the millisecond UTC instant, and explicit `"description": null` for an absent description are all
// part of the contract. PostgreSQL builds the identical text with `to_json(text)::text` string
// concatenation (never `jsonb`, which re-orders keys, and never `json_build_object`, which inserts
// spaces), so this side must use plain `JSON.stringify` over objects assembled in the fixed key
// order below and nothing else.

export const COMPLETION_CONTRACT_VERSION = 1 as const;

// §3.2 — exact text limits, measured AFTER trimming.
export const PERFORMED_ITEM_CATEGORY_MAX = 100;
export const PERFORMED_ITEM_NAME_MAX = 200;
export const PERFORMED_ITEM_DESCRIPTION_MAX = 2000;
export const PERFORMED_ITEMS_MIN = 1;
export const PERFORMED_ITEMS_MAX = 100;

// §4.3 — trimmed idempotency key, length 16–128. The key is generated once by the client and
// retained for every retry of the same intent; the format is deliberately permissive beyond length
// because the database CHECK constrains only btrim-stability and length.
export const IDEMPOTENCY_KEY_MIN = 16;
export const IDEMPOTENCY_KEY_MAX = 128;

// §3.4 — `actual_end_at` may not sit further in the future than database now() + 5 minutes.
export const ACTUAL_END_AT_MAX_FUTURE_MS = 5 * 60 * 1000;

// ─── Completion state (§3.4) ────────────────────────────────────────────────────

export type WorkOrderCompletionSourceStatus = "scheduled" | "in_progress" | "on_hold";

const COMPLETABLE_STATUSES: readonly WorkOrderCompletionSourceStatus[] = [
  "scheduled",
  "in_progress",
  "on_hold",
];

/**
 * Exact, literal transition test. `cancelled -> completed` is forbidden and `completed` is terminal
 * for this contract, so ONLY the three listed source statuses may complete. Unknown or legacy
 * status text is not coerced — it simply is not completable.
 */
export function canTransitionToCompleted(status: unknown): status is WorkOrderCompletionSourceStatus {
  return (
    typeof status === "string" &&
    (COMPLETABLE_STATUSES as readonly string[]).includes(status)
  );
}

// ─── Stable domain codes (§6) ───────────────────────────────────────────────────
// These are the codes application code keys on. They are never raw SQL text, and the database
// raises the same literals so one failure has one name on both sides.

export type WorkOrderCompletionDomainError =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "INVALID_STATE"
  | "IDEMPOTENCY_CONFLICT"
  | "ALREADY_COMPLETED_CONFLICT"
  | "RECOVERY_REQUIRED"
  | "COMPLETION_STATE_INCONSISTENT"
  | "REPORT_NUMBER_FAILED"
  | "STALE_VERSION";

export type WorkOrderCompletionOutcome = "created" | "replayed" | "recovered";

/** The single-row result shape of `public.complete_work_order_v1` (§5.1). */
export interface WorkOrderCompletionResult {
  readonly workOrderId: string;
  readonly completionReportId: string;
  readonly reportNumber: string;
  readonly performedWorkVersion: number;
  readonly requestFingerprint: string;
  readonly outcome: WorkOrderCompletionOutcome;
  readonly created: boolean;
  readonly replayed: boolean;
}

// ─── Performed-work snapshot (§3.2) ─────────────────────────────────────────────

/**
 * The EXACT client input shape: three fields, no more. `sort_order` is server-derived from array
 * position and is therefore not a client field; any monetary or extra key is REJECTED, never
 * ignored, so a caller cannot believe it stored a price that was silently dropped.
 */
export interface PerformedWorkItemInput {
  readonly category: string;
  readonly itemName: string;
  readonly description: string | null;
}

/** A validated, trimmed item with its array-derived order. The authority the fingerprint hashes. */
export interface NormalizedPerformedWorkItem {
  readonly category: string;
  readonly itemName: string;
  readonly description: string | null;
  readonly sortOrder: number;
}

export type PerformedWorkValidation =
  | { readonly ok: true; readonly items: readonly NormalizedPerformedWorkItem[] }
  | { readonly ok: false; readonly code: "VALIDATION_ERROR"; readonly detail: string };

const ALLOWED_ITEM_KEYS: readonly string[] = ["category", "itemName", "description"];

const invalid = (detail: string): PerformedWorkValidation => ({
  ok: false,
  code: "VALIDATION_ERROR",
  detail,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate and normalize the performed-work snapshot input.
 *
 *   • the input must be an array of 1–100 plain objects;
 *   • each object must have EXACTLY the keys category / itemName / description — an unexpected key
 *     (quantity, unitPrice, lineTotal, tax, discount, cost, margin, or anything else) is rejected
 *     by name so the error is actionable;
 *   • category and itemName are trimmed and must be 1–100 / 1–200 characters after trimming;
 *   • description is `string | null` (the key is REQUIRED so absence is a deliberate null, not an
 *     accident); a non-null description is trimmed, a trimmed-empty description becomes null, and a
 *     non-empty one may not exceed 2,000 characters;
 *   • sortOrder is derived from array position, beginning at 0 — never accepted from the client.
 *
 * The returned items are the ONLY values that may be fingerprinted or sent: hashing unvalidated
 * input would let two intents that normalize identically carry different fingerprints.
 */
export function validatePerformedWorkItems(input: unknown): PerformedWorkValidation {
  if (!Array.isArray(input)) {
    return invalid("performedItems must be an array");
  }
  if (input.length < PERFORMED_ITEMS_MIN) {
    return invalid("performedItems must contain at least 1 item");
  }
  if (input.length > PERFORMED_ITEMS_MAX) {
    return invalid("performedItems must contain at most 100 items");
  }

  const items: NormalizedPerformedWorkItem[] = [];
  for (let index = 0; index < input.length; index++) {
    const raw: unknown = input[index];
    if (!isPlainObject(raw)) {
      return invalid(`performedItems[${index}] must be an object`);
    }

    // Exact key set: reject rather than ignore, and name the offending key.
    for (const key of Object.keys(raw)) {
      if (!ALLOWED_ITEM_KEYS.includes(key)) {
        return invalid(`performedItems[${index}] has forbidden key "${key}"`);
      }
    }
    for (const key of ALLOWED_ITEM_KEYS) {
      if (!(key in raw)) {
        return invalid(`performedItems[${index}] is missing required key "${key}"`);
      }
    }

    const rawCategory = raw["category"];
    if (typeof rawCategory !== "string") {
      return invalid(`performedItems[${index}].category must be a string`);
    }
    const category = rawCategory.trim();
    if (category.length < 1 || category.length > PERFORMED_ITEM_CATEGORY_MAX) {
      return invalid(`performedItems[${index}].category must be 1-100 characters after trimming`);
    }

    const rawItemName = raw["itemName"];
    if (typeof rawItemName !== "string") {
      return invalid(`performedItems[${index}].itemName must be a string`);
    }
    const itemName = rawItemName.trim();
    if (itemName.length < 1 || itemName.length > PERFORMED_ITEM_NAME_MAX) {
      return invalid(`performedItems[${index}].itemName must be 1-200 characters after trimming`);
    }

    const rawDescription = raw["description"];
    let description: string | null;
    if (rawDescription === null) {
      description = null;
    } else if (typeof rawDescription === "string") {
      const trimmed = rawDescription.trim();
      if (trimmed.length > PERFORMED_ITEM_DESCRIPTION_MAX) {
        return invalid(
          `performedItems[${index}].description must be at most 2000 characters after trimming`,
        );
      }
      description = trimmed === "" ? null : trimmed;
    } else {
      return invalid(`performedItems[${index}].description must be a string or null`);
    }

    items.push({ category, itemName, description, sortOrder: index });
  }

  return { ok: true, items };
}

// ─── Idempotency key (§4.3) ─────────────────────────────────────────────────────

export type IdempotencyKeyValidation =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly code: "VALIDATION_ERROR"; readonly detail: string };

/**
 * Trim, then require length 16–128. The trimmed key is what travels: the database additionally
 * enforces `idempotency_key = btrim(idempotency_key)` on the stored row, so sending an untrimmed
 * key would make the same intent look like two keys.
 */
export function validateIdempotencyKey(input: unknown): IdempotencyKeyValidation {
  if (typeof input !== "string") {
    return { ok: false, code: "VALIDATION_ERROR", detail: "idempotency key must be a string" };
  }
  const key = input.trim();
  if (key.length < IDEMPOTENCY_KEY_MIN || key.length > IDEMPOTENCY_KEY_MAX) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      detail: "idempotency key must be 16-128 characters after trimming",
    };
  }
  return { ok: true, key };
}

// ─── actual_end_at window (§3.4) ────────────────────────────────────────────────

export type ActualEndAtValidation =
  | { readonly ok: true; readonly actualEndAt: Date }
  | { readonly ok: false; readonly code: "VALIDATION_ERROR"; readonly detail: string };

/**
 * Pure window check. `now` is INJECTED — the database clock is the runtime authority (the function
 * compares against database now() + 5 minutes); this pre-check merely refuses obviously invalid
 * intents client-side with the same rules:
 *
 *   • `actualEndAt` must be a real instant (an Invalid Date has a NaN time value);
 *   • when `actualStartAt` exists, `actualEndAt >= actualStartAt`;
 *   • `actualEndAt <= now + 5 minutes`.
 */
export function validateActualEndAt(
  actualEndAt: Date,
  actualStartAt: Date | null,
  now: Date,
): ActualEndAtValidation {
  const end = actualEndAt.getTime();
  if (Number.isNaN(end)) {
    return { ok: false, code: "VALIDATION_ERROR", detail: "actualEndAt is not a valid instant" };
  }
  if (Number.isNaN(now.getTime())) {
    return { ok: false, code: "VALIDATION_ERROR", detail: "now is not a valid instant" };
  }
  if (actualStartAt !== null) {
    const start = actualStartAt.getTime();
    if (Number.isNaN(start)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        detail: "actualStartAt is not a valid instant",
      };
    }
    if (end < start) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        detail: "actualEndAt must not be earlier than actualStartAt",
      };
    }
  }
  if (end > now.getTime() + ACTUAL_END_AT_MAX_FUTURE_MS) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      detail: "actualEndAt must not be more than 5 minutes in the future",
    };
  }
  return { ok: true, actualEndAt };
}

// ─── Canonical fingerprint serialization (§5.4) ─────────────────────────────────

/**
 * The exact millisecond UTC instant text hashed into the fingerprint: `Date#toISOString()`, i.e.
 * `YYYY-MM-DDTHH:MM:SS.sssZ` with the milliseconds ALWAYS present. PostgreSQL produces the same
 * text with `to_char(date_trunc('milliseconds', ts) AT TIME ZONE 'UTC',
 * 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` — microseconds beyond the millisecond are truncated on BOTH
 * sides before hashing, so a microsecond-precise database timestamp and its JavaScript reading
 * fingerprint identically.
 */
export function canonicalUtcInstant(instant: Date): string {
  return instant.toISOString();
}

/**
 * Build the ONE canonical JSON text the fingerprint hashes. Everything about this text is fixed:
 *
 *   • top-level key order: contractVersion, workOrderId, actualEndAt, performedItems;
 *   • item key order: category, itemName, description, sortOrder;
 *   • an absent description serializes as explicit `null`;
 *   • compact `JSON.stringify` output — no whitespace;
 *   • items appear in sortOrder (array) order, already 0-based and gap-free by construction.
 *
 * Inputs MUST already be the normalized values from `validatePerformedWorkItems` and a validated
 * key/instant: this function serializes, it does not re-validate. The authoritative fingerprint is
 * `lower(hex(sha256(utf8(thisText))))` — computed by the DATABASE; a TypeScript hash of this text
 * exists only as test-vector evidence.
 */
export function buildCompletionFingerprintCanonicalJson(
  workOrderId: string,
  actualEndAt: Date,
  items: readonly NormalizedPerformedWorkItem[],
): string {
  // Objects are assembled property-by-property in the contract order; JSON.stringify preserves
  // string-key insertion order, which is exactly what the PostgreSQL concatenation mirrors.
  return JSON.stringify({
    contractVersion: COMPLETION_CONTRACT_VERSION,
    workOrderId,
    actualEndAt: canonicalUtcInstant(actualEndAt),
    performedItems: items.map((item) => ({
      category: item.category,
      itemName: item.itemName,
      description: item.description,
      sortOrder: item.sortOrder,
    })),
  });
}

/** Stored fingerprints are lowercase hex SHA-256 (§4.3): exactly 64 hex characters. */
export function isCanonicalFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
