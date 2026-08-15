// DealerOS — Dealer Public Profile Projection (GHP-2 seed)
//
// Pure, side-effect-free public/private redaction boundary for the future GYEON
// website integration (GYEON_HP_STORE_DISCOVERY_INTEGRATION_SPEC.md). No Supabase,
// no fetch, no "use server" — this module never touches the network, Storage, or a
// database, and never resolves dealer identity or capability approval itself.
//
// Contract (fail-closed on every axis):
//   - The only identifier ever returned is the caller-supplied `opaquePublicId`.
//     `DealerPublicProfileSourceFacts` has no dealer_id field, so an internal id
//     cannot be forwarded even by accident.
//   - `DealerPublicProfileSourceFacts` lists only facts a store may ever request
//     to publish (spec §4.1). Private settings (bank account, invoice notes,
//     LINE identifiers, terms and conditions, ...) have no place in this type and
//     are never read, matching spec §12.1's exclusion list.
//   - A capability publishes only when its status is exactly "approved" AND `now`
//     falls within its validity window (spec §4.2, §3: "qualifications are not
//     self-certified"). requested/rejected/suspended/expired, an unknown
//     capability id, an invalid `now`, a present-but-blank/malformed/wrong-type
//     boundary, or a not-yet/no-longer-valid window all omit that capability —
//     never a downgraded or best-guess claim. Only `null`/`undefined` boundaries
//     mean unbounded on that side.
//   - Absent, blank, or non-string facts become `null`, never "" or a fabricated
//     placeholder.
//   - A missing, empty, or malformed capabilities list yields zero published
//     capabilities — never a default or all-capabilities fallback.

export type DealerPublicCapabilityId =
  | "gyeon_product_retailer"
  | "gyeon_authorized_dealer"
  | "gyeon_certified_detailer"
  | "gyeon_installation_store"
  | "gyeon_maintenance_store";

export const DEALER_PUBLIC_CAPABILITY_IDS: readonly DealerPublicCapabilityId[] = [
  "gyeon_product_retailer",
  "gyeon_authorized_dealer",
  "gyeon_certified_detailer",
  "gyeon_installation_store",
  "gyeon_maintenance_store",
];

/** True only for one of the five canonical, operator-owned capability ids. */
export function isDealerPublicCapabilityId(v: unknown): v is DealerPublicCapabilityId {
  return typeof v === "string" && (DEALER_PUBLIC_CAPABILITY_IDS as readonly string[]).includes(v);
}

export type DealerPublicCapabilityStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "expired";

/** Operator-owned capability record. Never store-editable — see spec §4.2/§3. */
export interface DealerPublicCapabilityInput {
  capability_id: DealerPublicCapabilityId;
  status: DealerPublicCapabilityStatus;
  /** ISO 8601. The capability is not current before this instant, if set. */
  valid_from?: string | null;
  /** ISO 8601. The capability is not current at/after this instant, if set (exclusive upper bound). */
  valid_through?: string | null;
}

export interface DealerPublicCapabilityProjection {
  capability_id: DealerPublicCapabilityId;
}

/**
 * Only the facts a store may ever request to publish (spec §4.1). Deliberately
 * NOT the full internal settings shape — private fields have no place here, so
 * they cannot be forwarded by accident even if a caller has a wider raw row.
 */
export interface DealerPublicProfileSourceFacts {
  public_display_name: string | null;
  public_short_description: string | null;
  public_full_description: string | null;
  postal_code: string | null;
  business_address: string | null;
  public_phone: string | null;
  public_email: string | null;
  inquiry_url: string | null;
}

export interface DealerPublicProfileProjection {
  public_store_id: string;
  display_name: string | null;
  short_description: string | null;
  full_description: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  inquiry_url: string | null;
  capabilities: DealerPublicCapabilityProjection[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function publicString(v: unknown): string | null {
  return isNonEmptyString(v) ? v : null;
}

/**
 * True only when `capability.valid_from`/`valid_through` is present (a
 * non-blank string that parses to a real instant); `null`/`undefined` means
 * that side is unbounded. A present-but-blank, malformed, or wrong-type value
 * fails closed rather than being silently treated as unbounded.
 */
function isValidTimestampBoundary(v: unknown): v is string {
  return isNonEmptyString(v) && !Number.isNaN(new Date(v).getTime());
}

/**
 * True only when `now` is itself a valid instant, `status` is exactly
 * "approved", AND `now` falls within [valid_from, valid_through). An invalid
 * `now`, any other status, a present-but-blank/malformed/wrong-type boundary,
 * or `now` outside the window all fail closed to `false`. `null`/`undefined`
 * boundaries mean unbounded on that side.
 */
export function isCapabilityCurrentlyValid(
  capability: Pick<DealerPublicCapabilityInput, "status" | "valid_from" | "valid_through">,
  now: Date,
): boolean {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  if (capability.status !== "approved") return false;

  if (capability.valid_from !== null && capability.valid_from !== undefined) {
    if (!isValidTimestampBoundary(capability.valid_from)) return false;
    if (now < new Date(capability.valid_from)) return false;
  }
  if (capability.valid_through !== null && capability.valid_through !== undefined) {
    if (!isValidTimestampBoundary(capability.valid_through)) return false;
    if (now >= new Date(capability.valid_through)) return false;
  }
  return true;
}

export interface BuildDealerPublicProfileProjectionOptions {
  /** Injectable for deterministic tests; defaults to `new Date()`. */
  now?: Date;
}

/**
 * Builds the redacted public projection of a store's facts. See the module
 * banner above for the full fail-closed contract.
 */
export function buildDealerPublicProfileProjection(
  facts: DealerPublicProfileSourceFacts,
  capabilities: readonly DealerPublicCapabilityInput[] | null | undefined,
  opaquePublicId: string,
  options: BuildDealerPublicProfileProjectionOptions = {},
): DealerPublicProfileProjection {
  if (!isNonEmptyString(opaquePublicId)) {
    throw new Error("buildDealerPublicProfileProjection: opaquePublicId is required");
  }

  const now = options.now ?? new Date();
  const source = Array.isArray(capabilities) ? capabilities : [];

  const seen = new Set<DealerPublicCapabilityId>();
  const published: DealerPublicCapabilityProjection[] = [];
  for (const capability of source) {
    if (capability == null || typeof capability !== "object") continue;
    if (!isDealerPublicCapabilityId(capability.capability_id)) continue;
    if (seen.has(capability.capability_id)) continue; // no duplicate publication
    if (!isCapabilityCurrentlyValid(capability, now)) continue;
    seen.add(capability.capability_id);
    published.push({ capability_id: capability.capability_id });
  }

  return {
    public_store_id: opaquePublicId,
    display_name: publicString(facts?.public_display_name),
    short_description: publicString(facts?.public_short_description),
    full_description: publicString(facts?.public_full_description),
    postal_code: publicString(facts?.postal_code),
    address: publicString(facts?.business_address),
    phone: publicString(facts?.public_phone),
    email: publicString(facts?.public_email),
    inquiry_url: publicString(facts?.inquiry_url),
    capabilities: published,
  };
}
