// EW-UI-3B — Wizard row-ID authority (PPF interior rows + other-work custom rows).
//
// SCOPE (Architect ruling R34B §3): these IDs are UI/draft ROW IDENTITY ONLY. They are NOT pricing
// identity, NOT estimate-item identity, NOT database identity. They must never affect calculated
// amounts, labels, persistence keys, or save idempotency. Once written into serviceConfiguration they
// are stable; the canonical patch adapter preserves supplied IDs exactly (never regenerates them).
//
// Generation: Web Crypto only — prefer crypto.randomUUID(), else crypto.getRandomValues() with
// RFC 4122 v4 bits. NEVER Math.random, NEVER time-based, NO mutable module counter. Every candidate
// is collision-checked against the supplied existing IDs; on secure-random unavailability, a thrown
// Web Crypto exception, malformed output, or exhausted retries this FAILS CLOSED by returning null
// (a generator exception is caught, never propagated). No React / pricing / save / DB
// import. It does NOT import src/lib/uuid/safe-random-uuid.ts.

/** The two — and only two — row kinds that own generated identity in Screen 4. */
export type WizardRowKind = "ppfInterior" | "otherWork";

/** Distinct, kind-specific prefixes so the two row families never share an ID namespace. */
const ROW_ID_PREFIX: Record<WizardRowKind, string> = {
  ppfInterior: "ppf",
  otherWork:   "ow",
};

/** Canonical RFC 4122 v4 shape (version nibble `4`, variant nibble `8|9|a|b`), lowercase hex. */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Bounded attempts to obtain a valid, non-colliding candidate before failing closed. */
const MAX_ATTEMPTS = 8;

/**
 * Minimal Web-Crypto surface this module needs. Both members are optional so a partial/absent source
 * fails closed rather than throwing. `globalThis.crypto` structurally satisfies this.
 */
export interface WizardRowIdCryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

/** Format 16 random bytes as an RFC 4122 v4 UUID (sets the version + variant bits). */
function bytesToUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/**
 * Produce ONE validated v4 UUID from the source, or null. Prefers native randomUUID; if that is
 * absent, THROWS, OR returns a malformed value, falls back to getRandomValues. If getRandomValues is
 * absent or THROWS, returns null. A throw from either Web Crypto method is caught and fails closed —
 * it is never propagated to the caller (approved fail-closed contract).
 */
function generateUuidV4(source: WizardRowIdCryptoSource): string | null {
  if (typeof source.randomUUID === "function") {
    try {
      const native = source.randomUUID();
      if (UUID_V4_RE.test(native)) return native;
      // Malformed native output → fall through to the getRandomValues path (bounded, not a throw).
    } catch {
      // randomUUID threw → fall through to the getRandomValues path (fail closed, never propagate).
    }
  }
  if (typeof source.getRandomValues === "function") {
    try {
      // Caller-owned 16-byte buffer; let getRandomValues fill it in place.
      const bytes = new Uint8Array(16);
      source.getRandomValues(bytes);
      const uuid = bytesToUuidV4(bytes);
      return UUID_V4_RE.test(uuid) ? uuid : null;
    } catch {
      // getRandomValues threw → fail closed (null), never propagate.
      return null;
    }
  }
  return null;
}

/**
 * Create a collision-free row ID for the given kind, or null (fail closed).
 *
 * @param kind         Which row family the ID belongs to (drives the prefix).
 * @param existingIds  All existing row IDs to avoid colliding with. NOT mutated (copied internally).
 * @param cryptoSource Optional Web-Crypto source; defaults to `globalThis.crypto`.
 * @returns `"<prefix>-<uuidv4>"`, or null if secure generation is unavailable or no unique valid ID
 *          can be produced within the bounded retry budget.
 */
export function createWizardRowId(
  kind: WizardRowKind,
  existingIds: Iterable<string>,
  cryptoSource?: WizardRowIdCryptoSource,
): string | null {
  const prefix = ROW_ID_PREFIX[kind];
  if (!prefix) return null; // unknown kind → fail closed

  const source =
    cryptoSource ??
    (typeof globalThis !== "undefined"
      ? (globalThis.crypto as WizardRowIdCryptoSource | undefined)
      : undefined);
  if (!source) return null; // no crypto → fail closed

  // Copy into a Set for O(1) membership WITHOUT mutating the caller's collection.
  const taken = new Set<string>(existingIds);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const uuid = generateUuidV4(source);
    if (uuid === null) return null; // generator unavailable/malformed → fail closed
    const candidate = prefix + "-" + uuid;
    if (!taken.has(candidate)) return candidate;
    // collision → retry within the bounded budget
  }
  return null; // repeated collision → fail closed
}
