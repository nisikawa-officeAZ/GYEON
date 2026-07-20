// B7-2B — the idempotency-session authority.
//
// PURE and fully injected: no React, no browser global read at module scope, no
// fetch, no Supabase, no save action. Storage, crypto and the URL-replacement
// callback all arrive as parameters, so every rule below is provable without a DOM.
//
// ── WHY A SESSION AUTHORITY EXISTS AT ALL ───────────────────────────────────
// A `useState` idempotency key survives re-render but not remount, and React 19
// Strict Mode remounts in development. A remount silently mints a NEW key, so what
// the operator experiences as one logical save can reach the RPC as two distinct
// submissions — creating a duplicate estimate at exactly the moment they are
// retrying a flaky save. The key therefore lives in per-tab storage, namespaced by
// a wizard session id, and is minted in exactly one place.
//
// ── THE LOAD-BEARING INVARIANT ──────────────────────────────────────────────
// Session-id creation and key creation are ONE indivisible flow, and that flow is
// the only thing that can mint a key. It cannot be entered from a URL. So a copied
// URL opened in a second tab — a valid `ws` with no stored record — CANNOT produce
// a second key for the same logical estimate; it fails closed instead. Splitting
// these into two callable steps would reintroduce the duplicate-creation hole.
//
// ── WHY THE URL IS UPDATED LAST ─────────────────────────────────────────────
// The record is persisted AND read back before the `ws` reaches the address bar.
// A `ws` can therefore only ever appear in a URL after its record exists, which is
// what makes "valid ws, no record" provably a different tab rather than a lost
// write. Updating the URL first would make that distinction a race.

import { IDEMPOTENCY_KEY_PATTERN } from "./wizard-save-intent-types";

// ── Identifier grammars ─────────────────────────────────────────────────────

/** URL-visible correlation handle. Carries NO authority of its own. */
const WIZARD_SESSION_ID_PATTERN = /^ws\.[0-9a-f]{32}$/;

/**
 * Canonical grouped UUID, declared locally on purpose.
 *
 * The authority is the save RPC's `v_estimate_id uuid`. It is NOT imported from
 * the observability module: that module is a different domain with its own locked
 * contract, and coupling an estimate-id check to it would make an observability
 * change able to alter what this module accepts as a redirect target.
 */
const ESTIMATE_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const STORAGE_KEY_PREFIX = "dealeros.ew.idem.v1:";
const RECORD_VERSION = 1;
const ID_BYTES = 16;   // 16 bytes → 32 lowercase hex characters

// ── Injected dependencies ───────────────────────────────────────────────────

/** The subset of `Storage` this module uses. Synchronous, like the real thing. */
export interface WizardSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The subset of Web Crypto this module uses. */
export interface WizardSessionCrypto {
  getRandomValues(array: Uint8Array): Uint8Array;
}

export interface WizardSessionDeps {
  readonly storage: WizardSessionStorage | null | undefined;
  readonly crypto: WizardSessionCrypto | null | undefined;
}

/** Called ONLY after a `ready` record is persisted and verified. */
export type WizardSessionUrlReplacer = (wizardSessionId: string) => void;

// ── Status and the branded validated session ────────────────────────────────

export type WizardSessionStatus = "ready" | "pending" | "failed" | "completed";

declare const WIZARD_SESSION_BRAND: unique symbol;

type SessionBrand = { readonly [WIZARD_SESSION_BRAND]: "validated-wizard-session" };

/**
 * A session that PROVABLY came from this module.
 *
 * The brand is a `declare const unique symbol` that is never exported and never
 * assigned at runtime, so an outside object literal cannot satisfy the type. A
 * component requiring `ValidatedWizardSession` therefore cannot be handed a
 * hand-built session — which is what makes "save is unreachable without a valid
 * session" a compile-time fact rather than a convention.
 *
 * `estimateId` exists ONLY on the completed arm: a non-completed session has no
 * estimate to redirect to, and giving it an optional field would let a caller read
 * `undefined` and route somewhere meaningless.
 */
export type ValidatedWizardSession =
  | (SessionBrand & {
      readonly wizardSessionId: string;
      readonly idempotencyKey: string;
      readonly status: "ready" | "pending" | "failed";
    })
  | (SessionBrand & {
      readonly wizardSessionId: string;
      readonly idempotencyKey: string;
      readonly status: "completed";
      readonly estimateId: string;
    });

// ── Results ─────────────────────────────────────────────────────────────────

/**
 * Every failure is a DISTINCT reason, because the caller must render them
 * differently: `missing-record` is a copied URL and offers "start a new estimate",
 * while `corrupt` and `storage-unavailable` are hard stops.
 */
export type WizardSessionFailureReason =
  | "invalid-session-id"
  | "missing-record"
  | "corrupt-record"
  | "storage-unavailable"
  | "crypto-unavailable"
  | "persist-failed"
  | "invalid-transition"
  | "invalid-estimate-id";

export type WizardSessionResult =
  | { readonly ok: true; readonly session: ValidatedWizardSession }
  | { readonly ok: false; readonly reason: WizardSessionFailureReason };

const fail = (reason: WizardSessionFailureReason): WizardSessionResult => ({ ok: false, reason });

// ── Internal helpers ────────────────────────────────────────────────────────

/** The exact persisted shape. Nothing else may be written. */
type StoredRecord =
  | { v: 1; key: string; status: "ready" | "pending" | "failed" }
  | { v: 1; key: string; status: "completed"; estimateId: string };

const storageKeyFor = (wizardSessionId: string): string => `${STORAGE_KEY_PREFIX}${wizardSessionId}`;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * 16 random bytes → 32 lowercase hex.
 *
 * Returns null on ANY crypto problem — absent, non-function, throwing, or a
 * buffer of the wrong length. There is deliberately no fallback: a predictable key
 * would defeat duplicate detection far more quietly than a refused save.
 */
function randomHex(crypto: WizardSessionCrypto | null | undefined): string | null {
  if (!crypto || typeof crypto.getRandomValues !== "function") return null;
  try {
    const buf = new Uint8Array(ID_BYTES);
    const filled = crypto.getRandomValues(buf);

    // ── WHY THERE IS NO FALLBACK TO `buf` ─────────────────────────────────
    // A previous version did `filled instanceof Uint8Array ? filled : buf`. That
    // was a FAIL-OPEN: a provider returning something other than a Uint8Array has
    // given no evidence it wrote anything, yet the fallback would read the local
    // buffer — still all zeros — and hand back
    // "00000000000000000000000000000000" as a perfectly well-formed identifier.
    // Two sessions would then share a key and silently collapse into one save.
    //
    // Only a conforming result is accepted: the provider contract (a Uint8Array)
    // and the exact length are validated. The VALUE is not judged — genuine
    // randomness can legitimately produce an all-zero buffer, and rejecting it on
    // appearance would be a bias, not a safety check.
    if (!(filled instanceof Uint8Array)) return null;
    if (filled.length !== ID_BYTES) return null;

    return toHex(filled);
  } catch {
    return null;
  }
}

/**
 * Prove the injected crypto is usable, and DISCARD the result.
 *
 * ── WHY RECOVERY NEEDS THIS AT ALL ──────────────────────────────────────────
 * A recovered session is handed to a caller that will go on to save, and a save
 * that later needs a fresh session — a new estimate after this one completes —
 * must be able to mint one. Returning a usable-looking session on a device where
 * crypto is unavailable defers the failure to the moment the operator presses
 * save, which is the worst possible time to discover it. Failing at recovery makes
 * the unusable environment visible before any work is done.
 *
 * The probe output is thrown away deliberately: it must never become a session id
 * or an idempotency key, and it is never persisted or returned. Only
 * `initializeWizardSession` may mint identity.
 */
function cryptoIsUsable(crypto: WizardSessionCrypto | null | undefined): boolean {
  const probe = randomHex(crypto);
  return probe !== null;   // value intentionally discarded
}

function readRaw(storage: WizardSessionStorage | null | undefined, key: string): string | null | "throw" {
  if (!storage || typeof storage.getItem !== "function") return "throw";
  try {
    return storage.getItem(key);
  } catch {
    return "throw";
  }
}

/** Parse + validate. Returns null for anything that is not an exact-shape record. */
function parseRecord(raw: string): StoredRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const o = parsed as Record<string, unknown>;
  if (o.v !== RECORD_VERSION) return null;
  if (typeof o.key !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(o.key)) return null;

  const status = o.status;
  const keys = Object.keys(o).sort();

  if (status === "completed") {
    // Exact key set — an extra property is a corrupt record, not a tolerable one.
    if (keys.join(",") !== "estimateId,key,status,v") return null;
    if (typeof o.estimateId !== "string" || !ESTIMATE_ID_PATTERN.test(o.estimateId)) return null;
    return { v: 1, key: o.key, status: "completed", estimateId: o.estimateId };
  }

  if (status !== "ready" && status !== "pending" && status !== "failed") return null;
  if (keys.join(",") !== "key,status,v") return null;
  return { v: 1, key: o.key, status };
}

function toSession(wizardSessionId: string, record: StoredRecord): ValidatedWizardSession {
  const base = { wizardSessionId, idempotencyKey: record.key };
  return (record.status === "completed"
    ? { ...base, status: "completed", estimateId: record.estimateId }
    : { ...base, status: record.status }) as ValidatedWizardSession;
}

/**
 * Write, then READ BACK and compare byte-for-byte.
 *
 * A `setItem` that silently no-ops (private-mode quirks, quota) would otherwise
 * leave the caller believing a key is durable when it is not — and a lost `pending`
 * is exactly what permits a duplicate save.
 */
function writeVerified(
  storage: WizardSessionStorage | null | undefined,
  key: string,
  record: StoredRecord,
): boolean {
  if (!storage || typeof storage.setItem !== "function") return false;
  const serialized = JSON.stringify(record);
  try {
    storage.setItem(key, serialized);
  } catch {
    return false;
  }
  const back = readRaw(storage, key);
  return back === serialized;
}

// ── Initialization: the ONLY key-minting flow ───────────────────────────────

/**
 * Mint a brand-new session.
 *
 * Ordering is the contract, and it is strict:
 *   1. generate + validate the wizard session id
 *   2. generate + validate exactly one idempotency key
 *   3. persist a `ready` record
 *   4. read it back and verify
 *   5. only then replace the URL
 *
 * Any failure short-circuits: no URL update, no validated session, and never a
 * persisted `pending`. A new session is ALWAYS `ready`.
 */
export function initializeWizardSession(
  deps: WizardSessionDeps,
  replaceUrl: WizardSessionUrlReplacer,
): WizardSessionResult {
  // 1. Session id.
  const sessionHex = randomHex(deps.crypto);
  if (sessionHex === null) return fail("crypto-unavailable");
  const wizardSessionId = `ws.${sessionHex}`;
  if (!WIZARD_SESSION_ID_PATTERN.test(wizardSessionId)) return fail("crypto-unavailable");

  // 2. Idempotency key — same flow, indivisible from step 1.
  const idempotencyKey = randomHex(deps.crypto);
  if (idempotencyKey === null) return fail("crypto-unavailable");
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) return fail("crypto-unavailable");

  // 3-4. Persist `ready` and verify by read-back.
  const record: StoredRecord = { v: 1, key: idempotencyKey, status: "ready" };
  if (!writeVerified(deps.storage, storageKeyFor(wizardSessionId), record)) {
    return fail("persist-failed");
  }

  // 5. Only now may the id become URL-visible.
  try {
    replaceUrl(wizardSessionId);
  } catch {
    // The record is durable; a failed URL update must not invalidate the session,
    // but it must not be silently swallowed either — the caller sees persist-failed
    // and can restart cleanly rather than run with an unaddressable session.
    return fail("persist-failed");
  }

  return { ok: true, session: toSession(wizardSessionId, record) };
}

// ── Recovery ────────────────────────────────────────────────────────────────

/**
 * Recover a session named by a URL `ws`.
 *
 * NEVER mints anything. A valid `ws` with no record is `missing-record` — the
 * copied-URL / second-tab case — and the caller must offer only "start a new
 * estimate", which re-enters initialization and mints a fresh `ws`.
 *
 * The grammar is checked BEFORE any storage access, so a malformed `ws` cannot
 * even probe for a key.
 *
 * ── PRECEDENCE IS PART OF THE CONTRACT ──────────────────────────────────────
 * The checks run in a fixed order, and the order is observable:
 *   1. ws grammar        → zero storage AND zero crypto calls on failure
 *   2. storage read      → `storage-unavailable` / `missing-record`
 *   3. record parse      → `corrupt-record`
 *   4. crypto usability  → `crypto-unavailable`
 * Step 4 is LAST on purpose. A missing record must never consume a crypto call,
 * because "valid ws, no record" is the copied-URL case and the whole point is that
 * it mints nothing.
 */
export function recoverWizardSession(
  deps: WizardSessionDeps,
  wizardSessionId: string,
): WizardSessionResult {
  if (typeof wizardSessionId !== "string" || !WIZARD_SESSION_ID_PATTERN.test(wizardSessionId)) {
    return fail("invalid-session-id");
  }

  const raw = readRaw(deps.storage, storageKeyFor(wizardSessionId));
  if (raw === "throw") return fail("storage-unavailable");
  if (raw === null) return fail("missing-record");

  const record = parseRecord(raw);
  if (record === null) return fail("corrupt-record");

  // Only a VALID record reaches here. Probe result discarded; nothing is minted.
  if (!cryptoIsUsable(deps.crypto)) return fail("crypto-unavailable");

  return { ok: true, session: toSession(wizardSessionId, record) };
}

// ── Transitions ─────────────────────────────────────────────────────────────

/**
 * Re-read, validate, transition, write, verify.
 *
 * The stored record — not the caller's session object — is the authority on every
 * transition. A caller holding a stale session (another tab advanced it) must not
 * be able to move the record backwards, so the current status is always re-read.
 * `key` and `wizardSessionId` are carried through byte-for-byte: a transition that
 * rotated the key would silently authorize a duplicate estimate.
 */
function transition(
  deps: WizardSessionDeps,
  wizardSessionId: string,
  allowedFrom: readonly WizardSessionStatus[],
  next: (current: StoredRecord) => StoredRecord | null,
): WizardSessionResult {
  // Inherits recovery's precedence INCLUDING the crypto-usability check, so an
  // unusable-crypto environment performs no write at all.
  const current = recoverWizardSession(deps, wizardSessionId);
  if (!current.ok) return current;

  const raw = readRaw(deps.storage, storageKeyFor(wizardSessionId));
  if (raw === "throw") return fail("storage-unavailable");
  if (raw === null) return fail("missing-record");
  const record = parseRecord(raw);
  if (record === null) return fail("corrupt-record");

  // `completed` is terminal: nothing transitions out of it.
  if (!allowedFrom.includes(record.status)) return fail("invalid-transition");

  const updated = next(record);
  if (updated === null) return fail("invalid-estimate-id");

  if (!writeVerified(deps.storage, storageKeyFor(wizardSessionId), updated)) {
    return fail("persist-failed");
  }
  return { ok: true, session: toSession(wizardSessionId, updated) };
}

/**
 * ready → pending, and explicit operator retry from `pending` or `failed`.
 *
 * `pending → pending` is permitted on purpose: a thrown or network-unknown outcome
 * leaves the record `pending` because the SERVER outcome is unknown, and the
 * operator's explicit retry must reuse the identical key rather than mint a new one.
 */
export function markWizardSessionPending(
  deps: WizardSessionDeps,
  wizardSessionId: string,
): WizardSessionResult {
  return transition(deps, wizardSessionId, ["ready", "pending", "failed"], (c) => ({
    v: 1, key: c.key, status: "pending",
  }));
}

/** pending → failed. A TYPED failure only; the key is never rotated. */
export function markWizardSessionFailed(
  deps: WizardSessionDeps,
  wizardSessionId: string,
): WizardSessionResult {
  return transition(deps, wizardSessionId, ["pending"], (c) => ({
    v: 1, key: c.key, status: "failed",
  }));
}

/**
 * pending → completed, with a VALIDATED canonical estimate id.
 *
 * Validation happens before the write, so an invalid id can never be persisted and
 * therefore can never be read back later and placed into a URL.
 */
export function markWizardSessionCompleted(
  deps: WizardSessionDeps,
  wizardSessionId: string,
  estimateId: string,
): WizardSessionResult {
  if (typeof estimateId !== "string" || !ESTIMATE_ID_PATTERN.test(estimateId)) {
    return fail("invalid-estimate-id");
  }
  return transition(deps, wizardSessionId, ["pending"], (c) => ({
    v: 1, key: c.key, status: "completed", estimateId,
  }));
}

/** Exposed for callers that must validate a redirect target before navigating. */
export function isValidEstimateId(value: unknown): boolean {
  return typeof value === "string" && ESTIMATE_ID_PATTERN.test(value);
}

/** Exposed so a host can validate a URL-supplied `ws` without touching storage. */
export function isValidWizardSessionId(value: unknown): boolean {
  return typeof value === "string" && WIZARD_SESSION_ID_PATTERN.test(value);
}
