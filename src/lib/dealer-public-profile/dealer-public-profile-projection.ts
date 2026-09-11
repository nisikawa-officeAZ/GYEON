// DealerOS — Dealer Public Profile Projection (GHP-2 seed)
//
// Pure, side-effect-free public/private redaction boundary for the future GYEON
// website integration (GYEON_HP_STORE_DISCOVERY_INTEGRATION_SPEC.md). No Supabase,
// no fetch, no "use server" — this module never touches the network, Storage, or a
// database, and never resolves dealer identity or capability approval itself.
//
// Contract (fail-closed on every axis):
//   - The only identifier ever returned is a runtime-validated `DealerPublicStoreId`
//     in the dedicated `PUB-...` namespace. A raw internal UUID or arbitrary caller
//     string is rejected before any projection is built.
//   - A projection is built only when lifecycle state is exactly `published`, the
//     store owner has consented, and the operator has approved publication.
//   - `DealerPublicProfileSourceFacts` lists only facts a store may ever request
//     to publish (spec §4.1). Private settings (bank account, invoice notes,
//     LINE identifiers, terms and conditions, ...) have no place in this type and
//     are never read, matching spec §12.1's exclusion list.
//   - A capability publishes only when its status is exactly "approved" AND `now`
//     falls within its validity window (spec §4.2, §3: "qualifications are not
//     self-certified"). requested/rejected/suspended/expired, an unknown
//     capability id, an invalid `now`, a present-but-blank/malformed/wrong-type
//     boundary, a duplicate/conflicting authority row, or a not-yet/no-longer-valid
//     window all omit that capability — never a downgraded or best-guess claim.
//     Only `null`/`undefined` boundaries mean unbounded on that side. Published
//     capabilities always use the canonical ID order, independent of input order.
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

declare const dealerPublicStoreIdBrand: unique symbol;

/** Opaque public identifier in a namespace that cannot be confused with an internal UUID. */
export type DealerPublicStoreId = string & {
  readonly [dealerPublicStoreIdBrand]: "DealerPublicStoreId";
};

const DEALER_PUBLIC_STORE_ID_PATTERN = /^PUB-[A-Z0-9](?:[A-Z0-9-]{0,62}[A-Z0-9])?$/;

export function isDealerPublicStoreId(v: unknown): v is DealerPublicStoreId {
  return typeof v === "string" && DEALER_PUBLIC_STORE_ID_PATTERN.test(v);
}

/** The sole supported conversion from an untrusted value to a public-store identifier. */
export function parseDealerPublicStoreId(v: unknown): DealerPublicStoreId {
  if (!isDealerPublicStoreId(v)) {
    throw new Error("parseDealerPublicStoreId: expected an opaque PUB-... identifier");
  }
  return v;
}

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

export type DealerPublicProfileLifecycleState =
  | "draft"
  | "submitted"
  | "approved"
  | "published"
  | "suspended"
  | "withdrawn";

/** Server-owned publication authority. Store-editable facts must not construct this value. */
export interface DealerPublicProfilePublicationAuthority {
  lifecycle_state: DealerPublicProfileLifecycleState;
  owner_publication_consent: boolean;
  operator_approved: boolean;
}

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
  if (!isNonEmptyString(v)) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;

  if (match[8] !== "Z") {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return !Number.isNaN(Date.parse(v));
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
  /** Required server-owned authority. Missing, mistyped, or non-published authority fails closed. */
  publication: DealerPublicProfilePublicationAuthority;
}

function isPublicationAuthorized(v: unknown): v is DealerPublicProfilePublicationAuthority {
  if (v == null || typeof v !== "object") return false;
  const authority = v as Partial<DealerPublicProfilePublicationAuthority>;
  return (
    authority.lifecycle_state === "published" &&
    authority.owner_publication_consent === true &&
    authority.operator_approved === true
  );
}

/**
 * Builds the redacted public projection of a store's facts. See the module
 * banner above for the full fail-closed contract.
 */
export function buildDealerPublicProfileProjection(
  facts: DealerPublicProfileSourceFacts,
  capabilities: readonly DealerPublicCapabilityInput[] | null | undefined,
  opaquePublicId: DealerPublicStoreId,
  options: BuildDealerPublicProfileProjectionOptions,
): DealerPublicProfileProjection {
  if (!isDealerPublicStoreId(opaquePublicId)) {
    throw new Error("buildDealerPublicProfileProjection: a valid public-store identifier is required");
  }
  if (!isPublicationAuthorized(options?.publication)) {
    throw new Error("buildDealerPublicProfileProjection: publication is not authorized");
  }

  const now = options.now ?? new Date();
  const source = Array.isArray(capabilities) ? capabilities : [];

  const published: DealerPublicCapabilityProjection[] = [];
  for (const capabilityId of DEALER_PUBLIC_CAPABILITY_IDS) {
    const matching = source.filter(
      (capability): capability is DealerPublicCapabilityInput =>
        capability != null &&
        typeof capability === "object" &&
        isDealerPublicCapabilityId(capability.capability_id) &&
        capability.capability_id === capabilityId,
    );

    // More than one authority row is ambiguous even when both rows look equal.
    // Do not guess which row is current: omit the capability until authority is reconciled.
    if (matching.length !== 1) continue;
    if (!isCapabilityCurrentlyValid(matching[0], now)) continue;
    published.push({ capability_id: capabilityId });
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
